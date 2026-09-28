import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the learning timebook experience closed to invited testers", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");

  assert.match(page, /我的学习小站/);
  assert.match(page, /收进时间册/);
  assert.match(page, /翻开这一页/);
  assert.match(page, /给我一点提示/);
  assert.match(page, /受邀登录/);
  assert.match(page, /只向受邀测试者开放/);
  assert.match(page, /请向管理员申请测试资格/);
  assert.doesNotMatch(page, /中国大陆手机号|获取验证码|注册并开始收录/);
  assert.match(page, /@phosphor-icons\/react/);
  assert.doesNotMatch(page, /api[_ -]?key|database|debug|模型参数/i);
});

test("keeps typography centralized and form controls readable", async () => {
  const styles = await readFile(new URL("app/globals.css", root), "utf8");
  const sourceOutsideTokens = styles.replace(/:root\s*\{[\s\S]*?\n\}/, "");

  assert.match(styles, /--text-base:\s*16px/);
  assert.match(styles, /--text-xl:\s*24px/);
  assert.match(styles, /min-height:\s*40px/);
  assert.doesNotMatch(sourceOutsideTokens, /font-size:\s*(?:\d|clamp)/);
});
