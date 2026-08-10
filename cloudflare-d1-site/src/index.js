const STATUS_LIST = ["not_started", "in_progress", "completed", "failed"];
const SESSION_DAYS = 30;

function userError(message) {
  const error = new Error(message);
  error.publicMessage = true;
  return error;
}

function publicMessage(error) {
  return error?.publicMessage ? error.message : "操作失败，请稍后再试。";
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function publicError(message = "操作失败，请稍后再试。", status = 400) {
  return json({ error: message }, status);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64UrlToBytes(salt),
      iterations: 120000,
      hash: "SHA-256",
    },
    key,
    256
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function normalizeUsername(value) {
  const username = String(value || "").trim();
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    throw userError("账号需要是3-24位字母、数字或下划线。");
  }
  return username;
}

function normalizePassword(value) {
  const password = String(value || "");
  if (password.length < 6) {
    throw userError("密码至少需要6位。");
  }
  if (password.length > 72) {
    throw userError("密码太长，请控制在72位以内。");
  }
  return password;
}

function normalizeDate(value, fieldName) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw userError(`${fieldName}时间格式不正确。`);
  }
  return new Date(time).toISOString();
}

function normalizeTitle(value) {
  const title = String(value || "").trim();
  if (!title) {
    throw userError("任务内容不能为空。");
  }
  if (title.length > 120) {
    throw userError("任务内容最多120个字。");
  }
  return title;
}

function normalizeStatus(value) {
  const status = String(value || "").trim();
  if (!STATUS_LIST.includes(status)) {
    throw userError("任务状态不正确。");
  }
  return status;
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
  };
}

function mapTask(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    deadlineAt: row.deadline_at,
    deadlineEdited: Boolean(row.deadline_edited),
    updatedAt: row.updated_at,
  };
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function createSession(db, userId) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, userId, now.toISOString(), expiresAt)
    .run();

  return token;
}

async function getSessionUser(request, env) {
  if (!env.DB) {
    return { error: publicError("服务暂时不可用，请稍后再试。", 500) };
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return { error: publicError("请先登录。", 401) };
  }

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const user = await env.DB
    .prepare(
      `SELECT users.id, users.username
       FROM sessions
       INNER JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?
         AND sessions.expires_at > ?`
    )
    .bind(tokenHash, now)
    .first();

  if (!user) {
    return { error: publicError("登录已失效，请重新登录。", 401) };
  }

  return { user: mapUser(user), tokenHash };
}

async function handleRegister(request, env) {
  if (!env.DB) return publicError("服务暂时不可用，请稍后再试。", 500);

  const body = await readBody(request);
  const username = normalizeUsername(body.username);
  const password = normalizePassword(body.password);
  const usernameNormalized = username.toLowerCase();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE username_normalized = ?").bind(usernameNormalized).first();
  if (existing) {
    throw userError("这个账号已经被注册。");
  }

  const salt = randomToken(16);
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  const user = { id: crypto.randomUUID(), username };

  await env.DB
    .prepare(
      `INSERT INTO users (id, username, username_normalized, password_salt, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(user.id, user.username, usernameNormalized, salt, passwordHash, now, now)
    .run();

  const token = await createSession(env.DB, user.id);
  return json({ user, token });
}

async function handleLogin(request, env) {
  if (!env.DB) return publicError("服务暂时不可用，请稍后再试。", 500);

  const body = await readBody(request);
  const username = normalizeUsername(body.username);
  const password = normalizePassword(body.password);
  const user = await env.DB
    .prepare("SELECT id, username, password_salt, password_hash FROM users WHERE username_normalized = ?")
    .bind(username.toLowerCase())
    .first();

  if (!user) {
    return publicError("账号或密码不正确。", 401);
  }

  const passwordHash = await hashPassword(password, user.password_salt);
  if (!safeEqual(passwordHash, user.password_hash)) {
    return publicError("账号或密码不正确。", 401);
  }

  const token = await createSession(env.DB, user.id);
  return json({ user: mapUser(user), token });
}

async function handleMe(request, env) {
  const auth = await getSessionUser(request, env);
  if (auth.error) return auth.error;
  return json({ user: auth.user });
}

async function handleLogout(request, env) {
  const auth = await getSessionUser(request, env);
  if (!auth.error) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(auth.tokenHash).run();
  }
  return json({ ok: true });
}

async function syncExpiredTasks(db, userId) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE tasks
       SET status = 'failed', updated_at = ?
       WHERE owner_id = ?
         AND status != 'completed'
         AND deadline_at <= ?`
    )
    .bind(now, userId, now)
    .run();
}

async function listTasks(db, userId) {
  await syncExpiredTasks(db, userId);
  const result = await db
    .prepare(
      `SELECT id, title, status, created_at, deadline_at, deadline_edited, updated_at
       FROM tasks
       WHERE owner_id = ?
       ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();

  return (result.results || []).map(mapTask);
}

async function createTask(request, db, userId) {
  const body = await readBody(request);
  const title = normalizeTitle(body.title);
  const deadlineAt = normalizeDate(body.deadlineAt, "结束");
  const now = new Date().toISOString();

  if (Date.parse(deadlineAt) <= Date.now()) {
    throw userError("结束时间必须晚于当前时间。");
  }

  const task = {
    id: crypto.randomUUID(),
    title,
    status: "not_started",
    createdAt: now,
    deadlineAt,
    deadlineEdited: false,
    updatedAt: now,
  };

  await db
    .prepare(
      `INSERT INTO tasks (id, owner_id, title, status, created_at, deadline_at, deadline_edited, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(task.id, userId, task.title, task.status, task.createdAt, task.deadlineAt, 0, task.updatedAt)
    .run();

  return json({ task });
}

async function updateTask(request, db, userId) {
  const body = await readBody(request);
  const id = String(body.id || "").trim();
  if (!id) {
    throw userError("缺少任务。");
  }

  await syncExpiredTasks(db, userId);

  const current = await db
    .prepare(
      `SELECT id, title, status, created_at, deadline_at, deadline_edited, updated_at
       FROM tasks
       WHERE id = ? AND owner_id = ?`
    )
    .bind(id, userId)
    .first();

  if (!current) {
    return publicError("任务不存在。", 404);
  }

  const now = new Date().toISOString();
  let title = current.title;
  let status = current.status;
  let deadlineAt = current.deadline_at;
  let deadlineEdited = Number(current.deadline_edited || 0);

  if (body.title !== undefined) {
    title = normalizeTitle(body.title);
  }

  if (body.deadlineAt !== undefined) {
    if (deadlineEdited) {
      throw userError("这个任务已经用过一次修改结束时间的机会。");
    }

    deadlineAt = normalizeDate(body.deadlineAt, "结束");
    if (Date.parse(deadlineAt) <= Date.now()) {
      throw userError("新的结束时间必须晚于当前时间。");
    }

    deadlineEdited = 1;
    if (status === "failed") {
      status = "in_progress";
    }
  }

  if (body.status !== undefined) {
    const nextStatus = normalizeStatus(body.status);
    if (nextStatus === "completed" && Date.parse(deadlineAt) <= Date.now()) {
      throw userError("任务已经过期，不能再标记为已完成。");
    }
    status = nextStatus;
  }

  await db
    .prepare(
      `UPDATE tasks
       SET title = ?, status = ?, deadline_at = ?, deadline_edited = ?, updated_at = ?
       WHERE id = ? AND owner_id = ?`
    )
    .bind(title, status, deadlineAt, deadlineEdited, now, id, userId)
    .run();

  const updated = await db
    .prepare(
      `SELECT id, title, status, created_at, deadline_at, deadline_edited, updated_at
       FROM tasks
       WHERE id = ? AND owner_id = ?`
    )
    .bind(id, userId)
    .first();

  return json({ task: mapTask(updated) });
}

async function deleteTask(request, db, userId) {
  const url = new URL(request.url);
  const body = request.headers.get("content-type")?.includes("application/json") ? await readBody(request) : {};
  const id = String(url.searchParams.get("id") || body.id || "").trim();
  if (!id) {
    throw userError("缺少任务。");
  }

  await db.prepare("DELETE FROM tasks WHERE id = ? AND owner_id = ?").bind(id, userId).run();
  return json({ ok: true });
}

async function handleTasks(request, env) {
  const auth = await getSessionUser(request, env);
  if (auth.error) return auth.error;

  try {
    if (request.method === "GET") {
      return json({ tasks: await listTasks(env.DB, auth.user.id) });
    }

    if (request.method === "POST") {
      return createTask(request, env.DB, auth.user.id);
    }

    if (request.method === "PATCH") {
      return updateTask(request, env.DB, auth.user.id);
    }

    if (request.method === "DELETE") {
      return deleteTask(request, env.DB, auth.user.id);
    }

    return publicError("不支持这个操作。", 405);
  } catch (error) {
    return publicError(publicMessage(error));
  }
}

async function handleAuth(request, env, pathname) {
  try {
    if (request.method === "POST" && pathname === "/api/auth/register") {
      return handleRegister(request, env);
    }

    if (request.method === "POST" && pathname === "/api/auth/login") {
      return handleLogin(request, env);
    }

    if (request.method === "GET" && pathname === "/api/auth/me") {
      return handleMe(request, env);
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      return handleLogout(request, env);
    }

    return publicError("不支持这个操作。", 405);
  } catch (error) {
    return publicError(publicMessage(error));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth/")) {
      return handleAuth(request, env, url.pathname);
    }

    if (url.pathname === "/api/tasks") {
      return handleTasks(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
