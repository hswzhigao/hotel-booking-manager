// Bug#1 修复复验（b95c4c7）：预订人表单「权益种类」下拉应显示 3 条种子
// 流程：新建预订人(出高尔夫) → 添加权益种类行 → 下拉验证3种子 → 选金葵花填次数 → 保存 → 列表回读 → 编辑回读 → 删除 → 权益种类管理Dialog验证
import {
  connectCtx, disconnect, login, nav, evalJs, realClick, typeInto, waitFor,
  waitNoMasks, find, check, failStep, shot, saveFacts, readTable, toastText,
} from './lib.mjs';

const NAME = 'E2E复验金葵花';
const ctx = await connectCtx('bug1-recheck');
const fail = [];

// 清空输入框（Vue 兼容：native setter + input 事件），规避浏览器自动填充残留
async function clearField(finder) {
  await evalJs(ctx, `(() => { const el = (${finder}); if (!el) throw new Error('clearField: not found'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
}
async function loginFresh() {
  // 已登录则跳过（/login 会被路由守卫重定向到 /）
  const already = await evalJs(ctx, `!!localStorage.getItem('hhao1121_token')`).catch(() => false);
  if (already) { await nav(ctx, 'http://localhost:5173/holders'); return; }
  await nav(ctx, 'http://localhost:5173/login');
  await waitFor(ctx, `document.querySelector('input[placeholder="请输入用户名"]')`, { timeout: 10000, desc: 'login form' });
  await clearField(find.byPh('请输入用户名'));
  await typeInto(ctx, find.byPh('请输入用户名'), 'admin');
  await clearField(find.byPh('请输入密码'));
  await typeInto(ctx, find.byPh('请输入密码'), 'admin123');
  const uv = await evalJs(ctx, `document.querySelector('input[placeholder="请输入用户名"]').value`);
  check('登录用户名输入正确', uv === 'admin', `value=<${uv}>`);
  await realClick(ctx, find.btn('登 录'));
  await waitFor(ctx, `location.pathname === '/' && document.querySelectorAll('.stat-card').length > 0`, { timeout: 10000, desc: 'dashboard after login' });
  await evalJs(ctx, 'new Promise(r => setTimeout(r, 600))');
}
try {
  // 0. 登录
  await loginFresh();
  await nav(ctx, 'http://localhost:5173/holders');
  await waitFor(ctx, find.btn('新建预订人'), { timeout: 10000, desc: 'holders toolbar' });
  await waitNoMasks(ctx);
  await shot(ctx, 'r0-holders-page');

  // 1. 打开新建预订人
  await realClick(ctx, find.btn('新建预订人'));
  await waitFor(ctx, `(() => { const t = document.querySelector('.el-dialog__title'); return t && t.textContent.trim() === '新建预订人'; })()`, { timeout: 8000, desc: 'create dialog' });
  await waitNoMasks(ctx);
  // 字典加载完成（核心修复点：loadTypes 兼容裸数组）
  await waitFor(ctx, `document.querySelectorAll('.el-select-dropdown__item').length >= 0 && true`, { timeout: 3000 }).catch(() => {});
  await evalJs(ctx, 'new Promise(r => setTimeout(r, 600))');

  // 2. 出高尔夫开关状态
  const golfSwitch = `(() => { const f = (${find.formItem('出高尔夫')}); const s = f && f.querySelector('.el-switch'); return s ? { on: s.classList.contains('is-checked') } : null; })()`;
  const sw = await evalJs(ctx, golfSwitch);
  check('出高尔夫开关默认开启', sw && sw.on === true, JSON.stringify(sw));
  if (!sw || !sw.on) { // 保险：手动开启
    await realClick(ctx, `(() => { const f = (${find.formItem('出高尔夫')}); return f.querySelector('.el-switch'); })()`);
    await evalJs(ctx, 'new Promise(r => setTimeout(r, 300))');
  }

  // 3. 添加权益种类行
  await realClick(ctx, find.btn('添加权益种类'));
  await waitFor(ctx, `document.querySelectorAll('.benefit-row').length === 1`, { timeout: 5000, desc: 'one benefit row' });

  // 4. 点击「权益种类」下拉 → 应显示 3 条种子
  await realClick(ctx, `document.querySelector('.benefit-row .el-select__wrapper')`);
  await waitFor(ctx, `[...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.getBoundingClientRect().height > 2).length > 0`, { timeout: 8000, desc: 'type dropdown open' });
  const opts = await evalJs(ctx, `(() => { const vs = [...document.querySelectorAll('.el-select-dropdown__item')].filter((o) => o.getBoundingClientRect().height > 2); return vs.map((o) => (o.textContent || '').trim()); })()`);
  const want = ['经典白高尔夫', '中信银行', '金葵花'];
  check('下拉显示3条种子', Array.isArray(opts) && opts.length === 3 && want.every((w) => opts.includes(w)), JSON.stringify(opts));
  await shot(ctx, 'r1-dropdown-3seeds');

  // 5. 选金葵花
  await realClick(ctx, find.option('金葵花'));
  await waitFor(ctx, `(() => { const w = document.querySelector('.benefit-row .el-select__wrapper'); return w && w.textContent.includes('金葵花'); })()`, { timeout: 5000, desc: '金葵花 selected' });

  // 6. 填剩余次数=3 + 姓名（先清空预填的 0，避免合成输入追加）
  await clearField(`document.querySelector('.benefit-row input[placeholder="剩余次数"]')`);
  await typeInto(ctx, `document.querySelector('.benefit-row input[placeholder="剩余次数"]')`, '3');
  await realClick(ctx, `(() => { const f = (${find.formItem('姓名')}); return f ? f.querySelector('.el-form-item__label') : null; })()`); // blur 触发 input-number 归一化
  const cnt = await evalJs(ctx, `document.querySelector('.benefit-row input[placeholder="剩余次数"]').value`);
  check('次数填入3', cnt === '3', `value=${cnt}`);
  await typeInto(ctx, find.formInput('姓名'), NAME);
  const nm = await evalJs(ctx, `(${find.formInput('姓名')}).value`);
  check('姓名填入', nm === NAME, `value=${nm}`);
  await shot(ctx, 'r2-form-filled');

  // 7. 保存
  await realClick(ctx, find.btn('保存'));
  await waitFor(ctx, `(document.body.innerText.includes('已创建') || document.body.innerText.includes('已更新'))`, { timeout: 10000, desc: 'create toast' });
  await waitFor(ctx, `!document.querySelector('.el-dialog__title')`, { timeout: 8000, desc: 'dialog closed' });
  await waitNoMasks(ctx);

  // 8. 列表回读：行明细含金葵花
  await waitFor(ctx, `[...document.querySelectorAll('.el-table__row')].some((r) => r.textContent.includes('${NAME}'))`, { timeout: 10000, desc: 'new row in list' });
  const rowText = await evalJs(ctx, `(() => { const r = [...document.querySelectorAll('.el-table__row')].find((x) => x.textContent.includes('${NAME}')); return r ? r.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
  check('列表回读含金葵花×3', rowText && rowText.includes('金葵花×3'), String(rowText).slice(0, 260));
  check('列表回读含出高尔夫标记', rowText && rowText.includes('出高尔夫'), '');
  await shot(ctx, 'r3-list-row');

  // 9. 编辑回读
  await realClick(ctx, `(() => { const r = [...document.querySelectorAll('.el-table__row')].find((x) => x.textContent.includes('${NAME}')); return r ? [...r.querySelectorAll('button')].find((b) => b.textContent.trim() === '编辑') : null; })()`);
  await waitFor(ctx, `(() => { const t = document.querySelector('.el-dialog__title'); return t && t.textContent.trim() === '编辑预订人'; })()`, { timeout: 8000, desc: 'edit dialog' });
  await waitNoMasks(ctx);
  await evalJs(ctx, 'new Promise(r => setTimeout(r, 500))');
  const editRead = await evalJs(ctx, `(() => {
    const row = document.querySelector('.benefit-row');
    const sel = row && row.querySelector('.el-select__wrapper');
    const cntIn = row && row.querySelector('input[placeholder="剩余次数"]');
    const nmIn = (${find.formInput('姓名')});
    const f = (${find.formItem('出高尔夫')});
    return {
      name: nmIn ? nmIn.value : null,
      type: sel ? sel.textContent.trim() : null,
      count: cntIn ? cntIn.value : null,
      golfOn: f ? !!f.querySelector('.el-switch.is-checked') : null,
    };
  })()`);
  check('编辑回读姓名', editRead.name === NAME, JSON.stringify(editRead));
  check('编辑回读种类=金葵花', editRead.type === '金葵花', '');
  check('编辑回读次数=3', editRead.count === '3', '');
  check('编辑回读出高尔夫=开', editRead.golfOn === true, '');
  await shot(ctx, 'r4-edit-readback');
  await realClick(ctx, find.btn('取消'));
  await waitFor(ctx, `!document.querySelector('.el-dialog__title')`, { timeout: 8000, desc: 'edit dialog closed' });

  // 10. 删除该预订人（清理 + 验证删除路径）
  await realClick(ctx, `(() => { const r = [...document.querySelectorAll('.el-table__row')].find((x) => x.textContent.includes('${NAME}')); return r ? [...r.querySelectorAll('button')].find((b) => b.textContent.trim() === '删除') : null; })()`);
  await waitFor(ctx, `document.querySelector('.el-message-box')`, { timeout: 8000, desc: 'confirm box' });
  await shot(ctx, 'r5-confirm-delete');
  await realClick(ctx, `(() => { const mb = document.querySelector('.el-message-box'); return mb && [...mb.querySelectorAll('button')].find((b) => b.textContent.trim() === '删除'); })()`);
  await waitFor(ctx, `document.body.innerText.includes('已删除')`, { timeout: 10000, desc: 'delete toast' });
  await waitFor(ctx, `![...document.querySelectorAll('.el-table__row')].some((r) => r.textContent.includes('${NAME}'))`, { timeout: 10000, desc: 'row removed' });
  check('删除后列表无该预订人', true);
  await shot(ctx, 'r6-after-delete');

  // 11. 权益种类管理 Dialog 表格 3 条种子
  await realClick(ctx, find.btn('权益种类'));
  await waitFor(ctx, `(() => { const t = document.querySelector('.el-dialog__title'); return t && t.textContent.includes('权益种类管理'); })()`, { timeout: 8000, desc: 'types dialog' });
  await waitNoMasks(ctx);
  await evalJs(ctx, 'new Promise(r => setTimeout(r, 400))');
  const tbl = await readTable(ctx, '适用球场');
  const names = tbl.rows.map((r) => r[0]);
  check('权益种类管理表格3条种子', names.length === 3 && want.every((w) => names.includes(w)), JSON.stringify(names));
  await shot(ctx, 'r7-types-dialog');
  await realClick(ctx, `(() => { const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.textContent.includes('权益种类管理')); return d && d.querySelector('.el-dialog__headerbtn'); })()`);
  await waitFor(ctx, `!document.querySelector('.el-dialog__title')`, { timeout: 8000, desc: 'types dialog closed' });

  saveFacts({ bug1_recheck: { name: NAME, dropdown: opts, list_row: String(rowText).slice(0, 200), edit_read: editRead, types_dialog: names } });
  console.log('DONE');
} catch (e) {
  failStep('bug1-recheck', e);
  await shot(ctx, 'r-fail').catch(() => {});
  fail.push(e.message);
} finally {
  disconnect(ctx);
}
