const STATUS_LIST = ["not_started", "in_progress", "completed", "failed"];

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function sha256(text) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function getOwnerId(request, env) {
  if (!env.DB) {
    return { error: json({ error: "Cloudflare 还没有绑定 D1 数据库，变量名必须叫 DB。" }, 500) };
  }

  if (!env.TODO_ACCESS_KEY) {
    return { error: json({ error: "Cloudflare 还没有设置 TODO_ACCESS_KEY 云端口令。" }, 500) };
  }

  const authorization = request.headers.get("Authorization") || "";
  const bearerKey = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const headerKey = request.headers.get("x-todo-key") || "";
  const accessKey = bearerKey || headerKey;

  if (!accessKey || accessKey !== env.TODO_ACCESS_KEY) {
    return { error: json({ error: "云端口令不正确。" }, 401) };
  }

  return { ownerId: await sha256(accessKey) };
}

function normalizeDate(value, fieldName) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    throw new Error(`${fieldName}时间格式不正确。`);
  }
  return new Date(time).toISOString();
}

function normalizeTitle(value) {
  const title = String(value || "").trim();
  if (!title) {
    throw new Error("任务内容不能为空。");
  }
  if (title.length > 120) {
    throw new Error("任务内容最多 120 个字。");
  }
  return title;
}

function normalizeStatus(value) {
  const status = String(value || "").trim();
  if (!STATUS_LIST.includes(status)) {
    throw new Error("任务状态不正确。");
  }
  return status;
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

async function syncExpiredTasks(db, ownerId) {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE tasks
       SET status = 'failed', updated_at = ?
       WHERE owner_id = ?
         AND status != 'completed'
         AND deadline_at <= ?`
    )
    .bind(now, ownerId, now)
    .run();
}

async function listTasks(db, ownerId) {
  await syncExpiredTasks(db, ownerId);

  const result = await db
    .prepare(
      `SELECT id, title, status, created_at, deadline_at, deadline_edited, updated_at
       FROM tasks
       WHERE owner_id = ?
       ORDER BY deadline_at ASC, created_at ASC`
    )
    .bind(ownerId)
    .all();

  return (result.results || []).map(mapTask);
}

async function createTask(request, db, ownerId) {
  const body = await readBody(request);
  const title = normalizeTitle(body.title);
  const deadlineAt = normalizeDate(body.deadlineAt, "结束");
  const now = new Date().toISOString();

  if (Date.parse(deadlineAt) <= Date.now()) {
    throw new Error("结束时间必须晚于当前时间。");
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
    .bind(task.id, ownerId, task.title, task.status, task.createdAt, task.deadlineAt, 0, task.updatedAt)
    .run();

  return json({ task });
}

async function updateTask(request, db, ownerId) {
  const body = await readBody(request);
  const id = String(body.id || "").trim();
  if (!id) {
    throw new Error("缺少任务 ID。");
  }

  await syncExpiredTasks(db, ownerId);

  const current = await db
    .prepare(
      `SELECT id, title, status, created_at, deadline_at, deadline_edited, updated_at
       FROM tasks
       WHERE id = ? AND owner_id = ?`
    )
    .bind(id, ownerId)
    .first();

  if (!current) {
    return json({ error: "任务不存在。" }, 404);
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
      throw new Error("这个任务已经用过一次修改结束时间的机会。");
    }

    deadlineAt = normalizeDate(body.deadlineAt, "结束");
    if (Date.parse(deadlineAt) <= Date.now()) {
      throw new Error("新的结束时间必须晚于当前时间。");
    }

    deadlineEdited = 1;
    if (status === "failed") {
      status = "in_progress";
    }
  }

  if (body.status !== undefined) {
    const nextStatus = normalizeStatus(body.status);
    if (nextStatus === "completed" && Date.parse(deadlineAt) <= Date.now()) {
      throw new Error("任务已经过期，不能再标记为已完成。");
    }
    status = nextStatus;
  }

  await db
    .prepare(
      `UPDATE tasks
       SET title = ?, status = ?, deadline_at = ?, deadline_edited = ?, updated_at = ?
       WHERE id = ? AND owner_id = ?`
    )
    .bind(title, status, deadlineAt, deadlineEdited, now, id, ownerId)
    .run();

  const updated = await db
    .prepare(
      `SELECT id, title, status, created_at, deadline_at, deadline_edited, updated_at
       FROM tasks
       WHERE id = ? AND owner_id = ?`
    )
    .bind(id, ownerId)
    .first();

  return json({ task: mapTask(updated) });
}

async function deleteTask(request, db, ownerId) {
  const url = new URL(request.url);
  const body = request.headers.get("content-type")?.includes("application/json") ? await readBody(request) : {};
  const id = String(url.searchParams.get("id") || body.id || "").trim();
  if (!id) {
    throw new Error("缺少任务 ID。");
  }

  await db.prepare("DELETE FROM tasks WHERE id = ? AND owner_id = ?").bind(id, ownerId).run();
  return json({ ok: true });
}

async function handleTasks(request, env) {
  const auth = await getOwnerId(request, env);
  if (auth.error) {
    return auth.error;
  }

  try {
    if (request.method === "GET") {
      return json({ tasks: await listTasks(env.DB, auth.ownerId) });
    }

    if (request.method === "POST") {
      return createTask(request, env.DB, auth.ownerId);
    }

    if (request.method === "PATCH") {
      return updateTask(request, env.DB, auth.ownerId);
    }

    if (request.method === "DELETE") {
      return deleteTask(request, env.DB, auth.ownerId);
    }

    return json({ error: "不支持这个请求方法。" }, 405);
  } catch (error) {
    return json({ error: error.message || "请求失败。" }, 400);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/tasks") {
      return handleTasks(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

