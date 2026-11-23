/* Form Platform: the visual form editor (step 25, part 2)
 * Load after fp-editor.js. Part of the editor app: FP.editor.formEditor(draft, ctx) returns the
 * Edit tab for a form.
 *
 *   Map         the whole form as one outline, each row opening its settings in place:
 *                 the form (title, sites, launcher, printing),
 *                 sources: a structure (one item, or a list: all of them or all where…) or a formula,
 *                   with each value it uses ticked read and/or write, and the fields that fill (←)
 *                   and show (→) it; "make a field for this" builds fields from the data,
 *                 fields in form order, buttons (and the forms they open, folded out), read first,
 *                 and the forms that open this one
 * Beside the map, the form itself:
 *   Order       (0.44, for touch screens too) the fields in order, each with a size (S, M, L, Full), "starts a
 *               new row", up and down, and which section or panel it is in; the form drawn on a terminal's
 *               own recorded screen, with the number pad's space and a line where the screen ends
 *   Try it      the form working as it will on a terminal; nothing is saved
 *
 *
 * FP.editor.functionEditor(draft, ctx) is the Edit tab for a function: a formula over its inputs, or a
 * lookup set up by picking (structure, which items match, what it gives back), with a try-it box.
 * Choosing where a field saves lists the form's one-item sources and their containers, and can make
 * a new source, structure or container on the spot. A form written before sources is converted
 * when it is opened (it saves exactly the same way).
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.editor || !FP.editor.ui) throw new Error('Load fp-editor.js before fp-form-editor.js');
  const { el, btn, input, select, formulaInput, chips, toast } = FP.editor.ui;
  const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const SLUG_RE = /^[a-z][a-z0-9-]{0,39}$/;
  const clone = x => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const target = w => { const i = String(w || '').indexOf('.'); return i > 0 ? { structure: w.slice(0, i), container: w.slice(i + 1) } : null; };
  const BUILT_IN = ['users', 'sites', 'media', 'submissions', 'acknowledgments'];
  const FACTS = ['lastAction', 'firstAt', 'lastAt', 'entryCount'];

  const CSS = `
  .ffe{display:grid;grid-template-columns:minmax(300px,var(--mapw,38%)) 10px minmax(0,1fr);gap:4px;align-items:start}
  .ffe.ffe-two{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
  .ffe-split{align-self:stretch;cursor:col-resize;border-radius:4px;position:relative;min-height:200px}
  .ffe-split::after{content:"";position:absolute;left:4px;top:40px;bottom:40px;width:2px;border-radius:1px;background:#d9dee5}
  .ffe-split:hover::after,.ffe-split.on::after{background:#1f5fbf;width:3px}
  @media (max-width:1000px){.ffe,.ffe.ffe-two{grid-template-columns:1fr}.ffe-split{display:none}}
  .ffe-sub{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 12px}
  .ffe-sub button{font:inherit;font-size:13px;font-weight:600;min-height:34px;padding:4px 12px;border:1px solid #c9d0d9;border-radius:999px;background:#fff;cursor:pointer}
  .ffe-sub button.on{background:#1b2633;border-color:#1b2633;color:#fff}
  .ffe-cols{display:grid;grid-template-columns:minmax(200px,.8fr) minmax(0,1.2fr);gap:12px;align-items:start}
  @media (max-width:760px){.ffe-cols{grid-template-columns:1fr}}
  .ffe-list{display:flex;flex-direction:column;gap:3px}
  .ffe-item{display:flex;align-items:center;gap:6px;padding:4px 6px 4px 0;border:1px solid #e3e7ec;border-radius:7px;background:#fff;cursor:pointer;min-height:36px;overflow:hidden}
  .ffe-item::before{content:"";align-self:stretch;width:5px;background:var(--c,#2a78d6);flex:none}
  .ffe-item:hover{background:#f3f7fd}.ffe-item.on{border-color:#1f5fbf;box-shadow:0 0 0 2px #c7d7ef}
  .ffe-item .txt{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;padding:2px 0}
  .ffe-item b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ffe-item small{color:#5b6573;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ffe-item .mv{border:0;background:none;font:inherit;cursor:pointer;color:#5b6573;padding:2px 4px;min-height:28px}
  .ffe-props{background:#fbfcfd;border:1px solid #e3e7ec;border-radius:10px;padding:10px 12px}
  .ffe-props h4{margin:0 0 8px;font-size:15px}
  .ffe-set{display:flex;flex-direction:column;gap:3px;margin:0 0 10px}
  .ffe-set>span{font-size:12px;font-weight:600;color:#5b6573}
  .ffe-set>span em{font-style:normal;font-weight:400}
  .ffe-setrow{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:center;margin:0 0 4px}
  .ffe-setrow>span{font-size:13px}
  .ffe-set input:not([type=checkbox]),.ffe-set select,.ffe-set textarea{width:100%}
  .ffe-set textarea{min-height:70px;font:13px/1.4 Consolas,monospace}
  .ffe-check{display:flex;align-items:center;gap:8px;font-size:14px;margin:0 0 10px}
  .ffe-check input{width:18px;height:18px}
  .ffe-group{border-left:3px solid #e3e7ec;padding-left:10px;margin:0 0 10px}
  .ffe-id{background:#fff7ea;border:1px solid #f0d9b0;border-radius:8px;padding:8px 10px;margin:4px 0 10px;font-size:13px}
  .ffe-id select{margin-top:4px}
  .ffe-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0 10px}
  .ffe-pick button{font:inherit;text-align:left;padding:8px 10px;border:1px solid #c9d0d9;border-radius:9px;background:#fff;cursor:pointer;min-height:54px}
  .ffe-pick button:hover{border-color:#1f5fbf;background:#f3f7fd}
  .ffe-pick button small{display:block;color:#5b6573;font-size:11px;margin-top:2px}
  .ffe-pick h5{grid-column:1/-1;margin:6px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#5b6573}
  .ffe-lay{display:flex;flex-direction:column;gap:6px}
  .ffe-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px;border:1px dashed #c9d0d9;border-radius:8px;background:#fff}
  .ffe-cell{display:inline-flex;align-items:center;gap:4px;padding:3px 4px 3px 9px;border-radius:7px;background:#e3edfb;font-size:13px;font-weight:600}
  .ffe-cell select{min-height:28px;padding:1px 4px;font-size:12px}
  .ffe-cell button,.ffe-row>button{border:0;background:none;cursor:pointer;font:inherit;color:#5b6573;min-height:28px}
  .ffe-block{border:1px solid #d9dee5;border-radius:10px;padding:8px;background:#fafbfc}
  .ffe-block>header{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:6px}
  .ffe-block>header b{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#5b6573}
  .ffe-adds{display:flex;flex-wrap:wrap;gap:6px}
  .ffe-prev{position:sticky;top:52px;border:1px solid #d9dee5;border-radius:12px;background:#fff;max-height:calc(100vh - 66px);overflow:auto}
  .ffe-prev>header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:#f4f6f8;border-bottom:1px solid #d9dee5;font-size:13px;font-weight:600;color:#5b6573}
  .ffe-prev>header select{min-height:30px;font-size:12px;padding:2px 6px}
  .ffe-prev .ffe-frame{padding:10px;margin:0 auto;box-sizing:border-box}
  .ffe-prev .stale{opacity:.45}
  .ffe-note{font-size:13px;color:#5b6573;margin:0 0 10px}
  .ffe-map{display:flex;flex-direction:column;gap:6px}
  .ffe-maprow{display:flex;gap:6px;align-items:flex-start;margin-bottom:6px}
  .ffe-maprow>*{flex:1 1 0;min-width:0}
  .ffe-maprow>button,.ffe-maprow>.fpe-hint{flex:none;align-self:center}
  .ffe-maprow.sb{flex-wrap:wrap}
  .ffe-maprow.sb>.how{flex:1 1 100%;display:flex;gap:6px;align-items:center}
  .ffe-maprow.sb>.how>select{flex:1 1 auto}
  .ffe-maprow select,.ffe-maprow input{width:100%}
  .ffm{display:flex;flex-direction:column;gap:3px}
  .ffm-h{display:flex;align-items:baseline;gap:8px;margin:14px 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5b6573}
  .ffm-h b{color:#1b2633}.ffm-h span{text-transform:none;letter-spacing:0}
  .ffm-r{display:flex;align-items:center;gap:6px;min-height:36px;padding:3px 6px 3px 0;border:1px solid #e3e7ec;border-radius:7px;background:#fff;cursor:pointer;overflow:hidden}
  .ffm-r::before{content:"";align-self:stretch;width:5px;background:var(--c);flex:none}
  .ffm-r:hover{background:#f3f7fd}
  .ffm-r.on{border-color:#1f5fbf;box-shadow:0 0 0 2px #c7d7ef}
  .ffm-r .body{display:flex;align-items:baseline;flex-wrap:wrap;column-gap:8px;flex:1 1 auto;min-width:0;padding:2px 0}
  .ffm-r .t{font-weight:600;white-space:nowrap}
  .ffm-r .d{color:#5b6573;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ffm-r .x{display:flex;gap:4px;flex:none}
  .ffm-r .mv{border:0;background:none;font:inherit;cursor:pointer;color:#5b6573;padding:2px 4px;min-height:28px}
  .ffm-r.top{min-height:44px}.ffm-r.top .t{font-size:16px}
  .ffm-r.src .t{color:#0b4f5c}
  .ffm-r.val{min-height:30px;background:#fbfcfd}.ffm-r.val .t{font-weight:500;font-family:Consolas,"Cascadia Mono",monospace;font-size:13px}
  .ffm-r.add{border-style:dashed;background:transparent}.ffm-r.add .t{font-weight:500;color:#5b6573}
  .ffm-r.kid{cursor:default;background:#fafbfc}.ffm-r.kid .t{font-weight:500}
  .ffm-tag{font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;background:#eef1f5;color:#3b4552;white-space:nowrap}
  .ffm-pill{font:inherit;font-size:11px;font-weight:700;min-height:24px;padding:1px 9px;border:1px dashed #c9d0d9;border-radius:999px;background:#fff;color:#8a94a3;cursor:pointer}
  .ffm-pill.on.read{border-style:solid;background:#e3edfb;border-color:#9ebce8;color:#1f5fbf}
  .ffm-pill.on.write{border-style:solid;background:#fff1e6;border-color:#f0b48a;color:#b45309}
  .ffm-r.idrow .t{font-weight:700;color:#0b4f5c}
  .ffm-r.idrow.unset{background:#fff6f5}.ffm-r.idrow.unset .d{color:#b42318;font-weight:600}
  .ffm-opt{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid #e3e7ec;border-radius:8px;background:#fff;margin:0 0 6px;cursor:pointer}
  .ffm-opt.on{border-color:#0e7490;box-shadow:0 0 0 2px #c7e3ea}
  .ffm-opt.off{opacity:.55;cursor:default}
  .ffm-opt input[type=radio]{width:18px;height:18px;margin-top:2px}
  .ffm-opt>span{display:flex;flex-direction:column;flex:1 1 300px}
  .ffm-opt small{color:#5b6573;font-size:12px}
  .ffm-optx{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding-left:26px}
  .ffm-optx select,.ffm-optx input{flex:1 1 200px}
  .ffm-mark{flex:none;width:18px;text-align:center;font-weight:800;font-size:15px;line-height:1}
  .ffm-mark.ok{color:#1a7f37}.ffm-mark.bad{color:#b42318}
  .ffm-r.has-err{border-color:#f3b0a8;background:#fff8f7}
  .ffm-r>button{white-space:nowrap;flex:none}
  .fsm-body{padding:10px 12px}
  .fsm-result{border-top:1px solid #e3e7ec;background:#fbfcfd}
  .fsm-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#5b6573;margin-bottom:4px}
  .fsm-out{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;word-break:break-word}
  .fsm-wrap{overflow-x:auto;max-width:100%;border:1px solid #e3e7ec;border-radius:8px}
  .fsm-items{border-collapse:collapse;font-size:13px;min-width:100%}
  .fsm-items th{position:sticky;top:0;background:#f4f6f8;text-align:left;font-weight:600;padding:6px 8px;border-top:3px solid #64748b;border-bottom:1px solid #d9dee5;white-space:nowrap;cursor:pointer}
  .fsm-items td{padding:5px 8px;border-bottom:1px solid #eef1f5;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
  .fsm-items .k-id{font-weight:600;color:#0b4f5c}
  .fsm-items .k-calculated{color:#5b21b6}.fsm-items .k-status{font-weight:600;color:#1a7f37}
  .fsm-items .sel{background:#eaf1fc}.fsm-items th.sel{background:#d9e6fa}
  .ffm-errs{color:#b42318;font-size:12px;margin:-1px 0 4px;padding:2px 8px;border-left:3px solid #f3b0a8}
  .ffm-props{border:1px solid #d9dee5;border-left:3px solid #1f5fbf;border-radius:8px;background:#fbfcfd;padding:10px 12px;margin:2px 0 8px}
  .ffa-mode{display:flex;gap:3px}
  .ffa-mode button{font:inherit;font-size:12px;font-weight:700;min-height:30px;padding:2px 12px;border:1px solid #c9d0d9;border-radius:999px;background:#fff;color:#3b4552;cursor:pointer}
  .ffa-mode button.on{background:#1b2633;border-color:#1b2633;color:#fff}
  .ffa-blockset{padding:0 12px}.ffa-blockset .ffe-props{margin-top:10px}
  .ffe-prev{container-type:inline-size}
  .ffo-work.order{display:grid;grid-template-columns:minmax(290px,360px) minmax(0,1fr);align-items:start}
  @container (max-width:780px){.ffo-work.order{grid-template-columns:minmax(0,1fr)}.ffo-work.order .ffo-list{position:static;max-height:42vh;border-right:0;border-bottom:1px solid #e3e7ec}}
  .ffo-list{position:sticky;top:47px;max-height:calc(100vh - 120px);overflow:auto;border-right:1px solid #e3e7ec;padding:10px 10px 14px;display:flex;flex-direction:column;gap:8px;background:#fbfcfd;container-type:inline-size}
  .ffo-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .ffo-cap{font-size:12px;font-weight:700;color:#5b6573;margin-right:4px}
  .ffo-seg{display:inline-flex;border:1px solid #c9d0d9;border-radius:9px;overflow:hidden;background:#fff}
  .ffo-seg button{font:inherit;font-size:13px;font-weight:700;min-width:44px;min-height:44px;padding:0 10px;border:0;border-left:1px solid #e3e7ec;background:#fff;color:#1b2633;cursor:pointer}
  .ffo-seg button:first-child{border-left:0}
  .ffo-seg button.on{background:#1f5fbf;color:#fff}
  .ffo-seg button:disabled{cursor:default}
  .ffo-items{display:flex;flex-direction:column;gap:4px}
  .ffo-it{border:1px solid #d9dee5;border-radius:10px;background:#fff;padding:4px 4px 4px 8px;display:flex;flex-direction:column;gap:4px}
  .ffo-it.sel{border-color:#1f5fbf;box-shadow:0 0 0 2px #c7d7ef}
  .ffo-l1,.ffo-l2{display:flex;align-items:center;gap:4px}
  .ffo-l2 select{flex:1 1 auto;min-width:0;min-height:44px;font-size:13px}
  .ffo-name{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:flex-start;text-align:left;font:inherit;border:0;background:none;padding:2px 0;cursor:pointer;color:#1b2633}
  .ffo-name b{font-size:14px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .ffo-name small{font-size:11px;color:#5b6573}
  .ffo-ic{font:inherit;font-size:16px;font-weight:700;width:44px;height:44px;flex:none;border:1px solid #c9d0d9;border-radius:9px;background:#fff;color:#1b2633;cursor:pointer}
  .ffo-ic:disabled{opacity:.35;cursor:default}
  .ffo-nr.on{background:#e6edfc;border-color:#1f5fbf;color:#163a9c}
  .ffo-block{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;font-weight:700;color:#0b4f5c;background:#e6f3f5;border-radius:8px;padding:2px 4px 2px 10px;text-transform:uppercase;letter-spacing:.03em}
  .ffo-block button{text-transform:none;letter-spacing:0}
  .ffo-sub{font-size:12px;font-weight:700;color:#0b4f5c;padding:4px 2px 0}
  .ffo-empty{font-size:12px;color:#8a94a3;border:1px dashed #c9d0d9;border-radius:8px;padding:8px}
  .ffo-off{border-top:1px solid #e3e7ec;padding-top:8px;display:flex;flex-direction:column;gap:6px}
  .ffo-off .ffo-row span{flex:1 1 auto;font-size:13px}
  .ffo-stage{min-width:0}
  .ffo-fit{margin:10px 10px 0;padding:8px 12px;border-radius:9px;font-size:13px;font-weight:600}
  .ffo-fit.ok{background:#e8f5ee;color:#18794e}.ffo-fit.over{background:#fff1e6;color:#8a3c06}
  .ffo-on .fpf-cell{cursor:pointer;border-radius:6px}
  .ffo-on .fpf-cell:hover{outline:1px dashed #9db8dc;outline-offset:3px}
  .ffo-on .fpf-cell.ffa-sel{outline:2px solid #1f5fbf;outline-offset:3px;background:#f3f7fd}
  .ffo-sizer{position:relative;overflow:hidden}
  .ffo-screen{position:absolute;top:0;left:0;display:flex;align-items:flex-start;transform-origin:0 0;background:#e4e6ea}
  .ffo-scr{background:#f4f6f8;flex:none}
  .ffo-scr .fpf-foot{position:static}
  .ffo-bar{height:60px;display:flex;align-items:center;padding:0 16px;background:#1b2633;color:#fff;font:700 18px/1 system-ui,"Segoe UI",sans-serif}
  .ffo-main{box-sizing:border-box;margin:0 auto;padding:18px 16px 0}
  .ffo-pad{flex:none;width:320px;box-sizing:border-box;border-left:2px dashed #8a93a3;background:repeating-linear-gradient(135deg,#e9ecf1 0 12px,#f4f5f8 12px 24px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#3e4450;font:15px/1.3 system-ui,"Segoe UI",sans-serif;text-align:center;padding:0 24px}
  .ffo-pad b{font-size:18px}
  .ffo-below{position:absolute;left:0;right:0;bottom:0;background:rgba(154,63,6,.10);pointer-events:none}
  .ffo-fold{position:absolute;left:0;right:0;border-top:3px dashed #9a3f06;pointer-events:none}
  .ffo-fold span{position:absolute;left:12px;top:6px;background:#9a3f06;color:#fff;font:700 14px/1 system-ui,"Segoe UI",sans-serif;padding:5px 10px;border-radius:6px}
  @container (min-width:600px){.ffo-it{flex-direction:row;align-items:center}.ffo-l1{flex:1 1 auto;min-width:0}.ffo-l2{flex:none}.ffo-l2 select{width:160px;flex:none}}
  .ffe3{display:grid;grid-template-columns:minmax(190px,230px) minmax(0,1fr) minmax(250px,290px);gap:10px;align-items:start}
  .ffe3-left .ffm-r .body{flex-wrap:nowrap;overflow:hidden}.ffe3-left .ffm-r{font-size:13px;min-height:32px}.ffe3-left .ffm-r .t{flex:0 0 auto;max-width:100%;overflow:hidden;text-overflow:ellipsis}.ffe3-left .ffm-r .d{flex:1 1 0;min-width:0}
  @media (max-width:1100px){.ffe3{grid-template-columns:minmax(200px,240px) minmax(0,1fr)}.ffe3-insp{grid-column:1/-1;position:static !important;max-height:none !important}}
  @media (max-width:760px){.ffe3{grid-template-columns:1fr}.ffe3-left{position:static !important;max-height:none !important}}
  .ffe3-left,.ffe3-insp{position:sticky;top:52px;max-height:calc(100vh - 140px);overflow:auto;background:#fff;border:1px solid #d9dee5;border-radius:12px;padding:8px;box-sizing:border-box}
  .ffe3-mid{min-width:0;background:#eef0f3;border:1px solid #d9dee5;border-radius:12px;padding:0 0 10px;position:relative}
  .ffe3-mid .stale{opacity:.45}
  .ffe3-bar{position:sticky;top:52px;z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;background:#f7f8fa;border-bottom:1px solid #d9dee5;border-radius:12px 12px 0 0;font-size:12px}
  .ffe3-bar select{min-height:30px;font-size:12px;padding:2px 6px}
  .ffe3-with{display:flex;align-items:center;gap:6px;color:#5b6573}
  .ffe3-mid>.ffe-note{margin:8px 12px 0}
  .ffe3-tabs{display:flex;gap:2px;background:#f1f3f7;border-radius:9px;padding:3px;margin:0 0 8px}
  .ffe3-tab{flex:1;font:inherit;font-size:13px;border:0;border-radius:7px;padding:6px 4px;background:none;color:#3b4552;cursor:pointer;min-height:32px}
  .ffe3-tab.on{background:#fff;font-weight:700;color:#1b2633;box-shadow:0 1px 2px rgba(0,0,0,.1)}
  .ffe3-tab.bad{color:#b42318}
  .ffm-blk{display:block;box-sizing:border-box;width:calc(100% - 4px);text-align:left;font:inherit;font-size:12px;font-weight:700;color:#0b4f5c;background:#e6f3f5;border:0;border-radius:7px;padding:6px 8px;margin:6px 0 2px;cursor:pointer}
  .ffm-blk.on{outline:2px solid #1f5fbf}
  .ffe3-stage{position:relative;padding:12px;overflow:auto}
  .ffe3-stage>.ffe-frame{margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(16,24,40,.08);padding:14px 16px;box-sizing:border-box}
  .ffe3-sel{position:absolute;border:2px solid #1f5fbf;border-radius:8px;pointer-events:none;z-index:4;box-sizing:border-box}
  .ffe3-seltag{position:absolute;left:-2px;top:-24px;background:#1f5fbf;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;white-space:nowrap}
  .ffe3-handle{position:absolute;right:-8px;top:50%;width:12px;height:30px;margin-top:-15px;background:#fff;border:2px solid #1f5fbf;border-radius:5px;cursor:ew-resize;pointer-events:auto;touch-action:none;box-sizing:border-box}
  .ffe3-drop{position:absolute;background:#1f5fbf;border-radius:2px;z-index:5;pointer-events:none}
  .ffe3-ghost{position:fixed;z-index:9999;pointer-events:none;background:#fff;border:1px solid #9db3ea;border-radius:7px;padding:6px 10px;font:600 13px system-ui,"Segoe UI",sans-serif;box-shadow:0 8px 20px rgba(16,24,40,.18)}
  .ffe3.dragging .fpf-cell{cursor:grabbing}
  .ffe3 .ffo-on .fpf-cell[hidden]{display:block !important;opacity:.5;outline:1px dashed #9aa4b2;outline-offset:2px;position:relative}
  .ffe3 .ffo-on .fpf-cell[hidden]::after{content:"sometimes shown";position:absolute;right:4px;top:2px;font:600 10px system-ui,sans-serif;color:#5b6573;background:#fff;padding:1px 4px;border-radius:4px}
  .ffe3-hint{font-size:12px;color:#5b6573;padding:0 12px}
  .ffe3-ih{display:flex;flex-direction:column;gap:2px;margin:2px 2px 10px;font-size:15px;font-weight:700}
  .ffe3-ih small{font-size:12px;color:#5b6573;font-weight:400}
  .ffe3-place{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid #e3e7ec;border-radius:10px;margin:0 0 10px;background:#fbfcfd}
  .ffe3-place select{min-height:40px}
  .ffe3-cap{font-size:11px;font-weight:700;color:#5b6573;text-transform:uppercase;letter-spacing:.05em}
  .ffe3-errs{white-space:pre-line;margin:0 0 8px;display:block}
  .ffe3-insp>.ffm-props{margin:0;border:0;padding:0;background:none}
  .ffe3-insp>.ffo-row{margin:0 0 10px}
  .ffe-kinds{border:1px solid #c7d7ef;background:#f5f8ff;border-radius:10px;padding:10px 12px;margin:8px 0}
  .ffe-kinds>b{font-size:15px}
  .ffe3 .ffo-nr.on{background:#e6edfc;border-color:#1f5fbf;color:#163a9c}`;
  /* ---------- Terminal screens (0.44) ----------
   * Every terminal at these sites that has told us its screen (fp-identity.js), with the space the number pad
   * takes: 320 px on the right of a landscape touch screen 900 px or wider, unless its keyboard is off. The
   * terminals that run the form come first, smallest screen first. */
  async function recordedScreens(sites, formId, formKeyboard) {
    const out = [];
    for (const e of await FP.identity.all().catch(() => [])) {
      if (!e || e.unreadable || !e.screen || !e.terminalId) continue;
      if (!(sites.includes('all') || sites.includes(e.site))) continue;
      const t = FP.groups ? await FP.groups.forTerminal(e.terminalId).catch(() => null) : null;
      const sc = e.screen;
      const keyboard = (t && t.keyboard) || 'auto';
      // A form whose keyboard is always (0.44.5) opens it on a screen without touch too.
      const pad = (sc.touch || formKeyboard === 'always') && keyboard !== 'never' && sc.width >= 900 && sc.width >= sc.height ? 320 : 0;
      out.push({ id: e.terminalId, name: (t && t.name) || '', w: sc.width, h: sc.height, touch: !!sc.touch, keyboard, pad, runs: !!(t && t.forms.includes(formId)) });
    }
    return out.sort((a, b) => (b.runs - a.runs) || (a.w * a.h - b.w * b.h));
  }
  /* How tall a form is on a screen, as a launcher shows it: its bar (60 px) and the form, at the width it gets. */
  async function heightOn(def, formId, sc) {
    const compact = def.density === 'compact';
    const box = el('div', 'ffo-scr');
    box.style.cssText = `position:fixed;left:-30000px;top:0;width:${sc.w - sc.pad}px;visibility:hidden;pointer-events:none`;
    const main = el('div', 'ffo-main');
    main.style.maxWidth = (compact ? 1680 : 1100) + 'px';
    main.style.paddingTop = (compact ? 12 : 18) + 'px';
    const host = el('div');
    main.appendChild(host); box.appendChild(main); document.body.appendChild(box);
    let inst = null;
    try {
      inst = await FP.forms.open(host, formId, { def, preview: true, draft: false });
      await new Promise(r => setTimeout(r, 300));
      return 60 + main.offsetHeight;
    } catch (_) { return null; } finally { if (inst) inst.destroy(); box.remove(); }
  }
  /* The publish check: does the form fit each recorded screen of the terminals that run it? [{ id, w, h, used, spare }] */
  async function screenFit(def, formId) {
    injectCss();
    const seen = new Map();
    const out = [];
    for (const sc of (await recordedScreens(def.sites || [], formId, def.keyboard)).filter(x => x.runs)) {
      const key = `${sc.w - sc.pad}x${def.density || ''}`;
      if (!seen.has(key)) seen.set(key, await heightOn(def, formId, sc));
      const used = seen.get(key);
      if (used != null) out.push(Object.assign({}, sc, { used, spare: sc.h - used }));
    }
    return out;
  }

  function injectCss() { if (document.getElementById('fp-form-editor-css')) return; const s = el('style'); s.id = 'fp-form-editor-css'; s.textContent = CSS; document.head.appendChild(s); }

  /* A field name from a label: "Measured OD" → measuredOD; unique among taken. */
  function nameFrom(label, taken) {
    const words = String(label || 'field').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    let n = words.map((w, i) => (i === 0 ? w[0].toLowerCase() + w.slice(1) : w[0].toUpperCase() + w.slice(1))).join('') || 'field';
    if (!/^[A-Za-z]/.test(n)) n = 'f' + n;
    n = n.slice(0, 36);
    let out = n, i = 2;
    while (taken.has(out)) out = n + i++;
    return out;
  }
  const catColor = cat => (cat === 'entry' ? '#2a78d6' : cat === 'visual' ? '#7c3aed' : '#64748b');

  /* ---------- Where a structure's items get their IDs ---------- */
  function idRule(st) {
    const d = FP.defs.get('structure', st);
    const t = (d && d.def.itemId) || {};
    return { label: t.label || 'ID', made: t.made || null, prefix: t.prefix || null, published: !!d };
  }

  /* ---------- Renaming a field everywhere it is named ---------- */
  function renameField(def, from, to) {
    const re = new RegExp(`(?<![\\w.$])${from}(?![\\w])`, 'g');
    const inFormula = f => String(f).split(/("(?:[^"\\]|\\.)*")/).map((part, i) => (i % 2 ? part : part.replace(re, to))).join('');
    // In a filter, bare names are the item's values; the form's own are form.name.
    const reForm = new RegExp(`(?<![\\w.$])form\\.${from}(?![\\w])`, 'g');
    const inFilter = f => String(f).split(/("(?:[^"\\]|\\.)*")/).map((part, i) => (i % 2 ? part : part.replace(reForm, 'form.' + to))).join('');
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(k => {
        const v = o[k];
        if (typeof v === 'string' && ['formula', 'when', 'optionsFrom'].includes(k)) o[k] = inFormula(v);
        else if (typeof v === 'string' && k === 'filter') o[k] = inFilter(v);
        else if (v && typeof v === 'object') walk(v);
      });
    })(def);
    const cells = rows => FP.layout.rows(rows, r => r.forEach((c, i) => { const p = String(c).trim().split(/\s+/); if (p[0] === from) { p[0] = to; r[i] = p.join(' '); } }));
    cells(def.layout);
    Object.values(def.items || {}).forEach(c => { if (c && c.field === from) c.field = to; });
    (def.sources || []).forEach(src => { if (src && src.id && src.id.field === from) src.id.field = to; });
    (def.buttons || []).forEach(b => {
      if (!b) return;
      if (Array.isArray(b.scope)) b.scope = b.scope.map(n => (n === from ? to : n));
      Object.keys(b.prefill || {}).forEach(k => { b.prefill[k] = inFormula(b.prefill[k]); });
      if (b.apply && Object.prototype.hasOwnProperty.call(b.apply, from)) { b.apply[to] = b.apply[from]; delete b.apply[from]; }
    });
  }
  /* Renaming a source: formulas that read it, and fields and buttons that save to it. */
  function renameSource(def, from, to) {
    renameField(def, from, to);
    (def.fields || []).forEach(f => ['writes', 'snapshot'].forEach(k => { const t = f && target(f[k]); if (t && t.structure === from) f[k] = `${to}.${t.container}`; }));
    (def.buttons || []).forEach(b => { if (b && b.link === from) b.link = to; });
  }
  /* A form written before sources, converted in place: each structure it saves to becomes a one-item source. */
  function toSources(draft) {
    if (!FP.sources || !draft) return draft;
    if (Array.isArray(draft.sources)) { FP.sources.inferValues(draft); return draft; }
    const c = FP.sources.fromLegacy(draft);
    draft.fields = c.fields;
    if (c.buttons) draft.buttons = c.buttons;
    if (c.sources) draft.sources = c.sources;
    delete draft.items;
    return draft;
  }
  /* Take a field out of the layout (when it is deleted). */
  function unplace(rows, name) {
    FP.layout.rows(rows, r => { for (let j = r.length - 1; j >= 0; j--) if (FP.layout.nameOf(r[j]) === name) r.splice(j, 1); });
    // Rows left empty go, in every list.
    const prune = list => { for (let i = (list || []).length - 1; i >= 0; i--) { if (Array.isArray(list[i])) { if (!list[i].length) list.splice(i, 1); } else FP.layout.lists(list[i]).forEach(prune); } };
    prune(rows);
  }
  function placedNames(rows, out) {
    out = out || new Set();
    FP.layout.cells(rows).forEach(c => out.add(FP.layout.nameOf(c)));
    return out;
  }
  function layoutLabels(rows, out) {
    out = out || [];
    (rows || []).forEach(r => {
      if (!r || Array.isArray(r) || typeof r !== 'object') return;
      if (Array.isArray(r.rows)) { if (r.section) out.push(['section', r.section]); layoutLabels(r.rows, out); }
      (r.tabs || []).forEach(t => { if (t) { out.push(['tab', t.tab]); layoutLabels(t.rows, out); } });
      (r.steps || []).forEach(t => { if (t) { out.push(['step', t.step]); layoutLabels(t.rows, out); } });
    });
    return out;
  }

  /* Tidy a form before it is checked, previewed or published: items only for structures still saved to. */
  function tidyForm(def) {
    const d = clone(def);
    if (Array.isArray(d.sources)) {
      delete d.items;
      if (!d.sources.length) delete d.sources;
      if (Array.isArray(d.acknowledge) && !d.acknowledge.length) delete d.acknowledge;
      if (Array.isArray(d.media) && !d.media.length) delete d.media;
      return d;
    }
    const used = new Set();
    (d.fields || []).forEach(f => [f && f.writes, f && f.snapshot].forEach(w => { const t = target(w); if (t) used.add(t.structure); }));
    Object.keys(d.items || {}).forEach(s => { if (!used.has(s)) delete d.items[s]; });
    if (d.items && !Object.keys(d.items).length) delete d.items;
    if (Array.isArray(d.acknowledge) && !d.acknowledge.length) delete d.acknowledge;
    if (Array.isArray(d.media) && !d.media.length) delete d.media;
    return d;
  }

  /* ---------- The editor ---------- */
  function formEditor(draft, ctx) {
    injectCss();
    draft.fields = Array.isArray(draft.fields) ? draft.fields : [];
    // Editing a sub-form (0.40): the same editor, on the sub-form inside the master form (ctx.subOf).
    const subOf = ctx.subOf || null;
    const state = ctx.formState || (ctx.formState = { tab: 'map', open: null, width: 'pc' });
    if (ctx.focus && ctx.focus.field) { state.tab = 'map'; state.left = 'fields'; state.open = 'f:' + ctx.focus.field; ctx.focus = null; }
    if (ctx.focus && ctx.focus.button) { state.tab = 'map'; state.open = 'b:' + ctx.focus.button; ctx.focus = null; }
    // 0.58: three columns. On the left the form's outline in three tabs (Fields, Data, Form); in the middle the form
    // itself, drawn as it will show, where fields are picked, dragged and sized; on the right the settings of
    // whatever is picked (a field, a button, a section, a source, the form).
    const root = el('div', 'ffe3');
    const left = el('div', 'ffe3-left');
    const prev = el('div', 'ffe3-mid');
    const insp = el('div', 'ffe3-insp');
    root.append(left, prev, insp);
    if (!['fields', 'data', 'form'].includes(state.left)) state.left = 'fields';
    const tabsBar = el('div', 'ffe3-tabs');
    tabsBar.setAttribute('role', 'tablist');
    const sub = el('div', 'ffe-sub');
    const pane = el('div');
    left.append(tabsBar, sub, pane);
    const changed = () => { syncReads(); ctx.changed(); schedulePreview(); };
    // A formula that reads source.value ticks that value read on the source, so the map always shows it.
    function syncReads() {
      if (!Array.isArray(draft.sources)) return;
      const formulas = [];
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        Object.keys(o).forEach(k => { const v = o[k]; if (typeof v === 'string' && ['formula', 'when', 'optionsFrom', 'filter'].includes(k)) formulas.push(v); else if (v && typeof v === 'object') walk(v); });
      })({ fields: draft.fields, buttons: draft.buttons, layout: draft.layout, acknowledge: draft.acknowledge, sources: draft.sources });
      formulas.forEach(f => tokensOf(f).forEach(t => {
        if (t.type !== 'name' || t.text.indexOf('.') < 0) return;
        const [root, c] = t.text.split('.');
        const x = srcByName(root);
        if (!x || x.kind === 'value' || !x.structure || !c || c[0] === '$') return;
        if (reads(useOf(x, c)) || !containersOf(x.structure).some(([n]) => n === c)) return;
        setUse(x, c, true, writes(useOf(x, c)));
      }));
    }
    const fieldNames = () => draft.fields.map(f => f.name);
    const byName = n => draft.fields.find(f => f.name === n);
    const isEntry = f => !!(f && FP.forms.describe(f.control) && FP.forms.describe(f.control).category === 'entry');
    toSources(draft);
    draft.sources = Array.isArray(draft.sources) ? draft.sources : [];
    const srcByName = n => draft.sources.find(x => x && x.name === n);
    const itemSources = () => draft.sources.filter(x => x && x.kind === 'item');
    const takenNames = () => new Set(fieldNames().concat((draft.buttons || []).map(b => b && b.name), draft.sources.map(x => x && x.name), (Array.isArray(draft.subforms) ? draft.subforms : []).map(x => x && x.name)).filter(Boolean));

    // What a structure holds, for pickers and chips: its containers, worked-out values, what forms save
    // to it, and (for built-in structures and new data) what its latest items hold.
    const sampled = {};
    const sample = st => {
      if (!st || sampled[st]) return;
      sampled[st] = new Set();
      FP.current.load(st).then(r => { Array.from(r.items.values()).slice(-30).forEach(it => Object.keys(FP.current.publicValues(st, it.values || {})).forEach(k => sampled[st].add(k))); }).catch(() => {});
    };
    function containersOf(st) {
      const out = new Map();
      const d = FP.defs.get('structure', st);
      const def = d ? d.def : FP.structures.get(st);
      Object.keys((def && def.containers) || {}).forEach(n => out.set(n, 'container'));
      FP.map.usedBy('structure', st).forEach(u => { const m = /^saves (?:its value )?to (\w+)$/.exec(u.how || ''); if (m && !out.has(m[1])) out.set(m[1], 'container'); });
      itemSources().filter(x => x.structure === st).forEach(x => draft.fields.forEach(f => [f.writes, f.snapshot].forEach(w => { const t = target(w); if (t && t.structure === x.name && !out.has(t.container)) out.set(t.container, 'container'); })));
      sample(st);
      (sampled[st] || []).forEach(n => { if (!out.has(n)) out.set(n, 'container'); });
      Object.keys((def && def.calculated) || {}).forEach(n => out.set(n, 'calculated'));
      if (((def && def.status) || []).length) out.set('status', 'status');
      return Array.from(out.entries());
    }
    const ITEM_FACTS = ['$id', '$status', '$action', '$form', '$at', '$firstAt', '$entryCount', '$site'];
    const FILTER_FACTS = ['id', 'status', 'lastAction', 'lastForm', 'firstAt', 'lastAt', 'entryCount', 'site'];

    // Names a formula here can read: the form's fields, its sources, and what each one-item source holds.
    const formulaHelp = (withItem, extra) => ({
      names: () => {
        const out = (withItem ? [['item', 'action']] : []).concat((extra || []).map(n => [n, 'fact'])).concat(draft.fields.map(f => [f.name, isEntry(f) ? 'container' : 'calculated']));
        if (subOf) {
          (subOf.master.fields || []).forEach(f => out.push([f.name, 'from']));
          (subOf.master.sources || []).forEach(x => { if (x && x.name) out.push([x.name, 'from']); });
          if (FP.forms.repeatKind(subOf.sf) !== 'once') out.push(['index', 'fact'], ['each', 'fact'], ['others', 'fact']);
        }
        (Array.isArray(draft.subforms) ? draft.subforms : []).forEach(x => { if (x && x.name) out.push([x.name, 'from']); });
        draft.sources.forEach(x => {
          if (!x || !x.name) return;
          out.push([x.name, 'from']);
          // The values ticked on the source first; the rest of what it holds after (tapping one ticks it read).
          if (x.kind !== 'value' && x.structure) {
            const all = containersOf(x.structure);
            const on = all.filter(([c]) => (x.values || {})[c]);
            on.concat(all.filter(([c]) => !(x.values || {})[c])).forEach(([c, k]) => out.push([`${x.name}.${c}`, (x.values || {})[c] ? (k === 'container' ? 'from' : k) : 'fact']));
          }
        });
        return out;
      },
      unknown: 'not a field or source of this form',
    });
    // A many-items filter reads each item: its values and facts, and the form's own values as form.name.
    const filterHelp = st => ({
      names: () => containersOf(st).concat(FILTER_FACTS.map(n => [n, 'fact']), draft.fields.map(f => [`form.${f.name}`, 'action']), [['form', 'action']]),
      unknown: `not a value of ${st}`,
    });
    const savedNamesFor = sts => {
      const out = new Set();
      sts.forEach(st => FP.defs.saveNames(st, ctx.id).forEach(a => out.add(a)));
      return Array.from(out).sort();
    };
    // Which item a one-item source is, in words.
    const idText = x => {
      const id = (x && x.id) || {};
      if (id.field) { const f = byName(id.field); return `the item entered in ${f ? f.label || f.name : id.field}`; }
      if (id.fixed) return `always item ${id.fixed}`;
      if (id.where != null) return `the latest item where ${id.where || '…'}`;
      if (id.open != null) return openWords(id.open);
      if (id.generate) return 'a new item each save';
      return 'not chosen yet';
    };
    // The open one (0.60), in words: the open one whose line is Line.
    const openWords = o => `the open one${Object.entries(o || {}).map(([k, v]) => { const f = byName(v); return ` whose ${humanize(k).toLowerCase()} is ${f ? f.label || f.name : v}`; }).join(' and')}`;
    const defaultId = st => (idRule(st).made === 'entered' || FP.sources.BUILT_IN.includes(st) ? {} : { generate: true });
    function addSource(kind, st) {
      const label = { item: 'item', items: 'items', value: 'value' }[kind];
      const name = st ? FP.sources.nameFor(st, takenNames()) : FP.sources.nameFor(label, takenNames());
      const x = { name, kind };
      if (kind !== 'value') x.structure = st || '';
      if (kind === 'item') x.id = st ? defaultId(st) : {};
      if (kind === 'value') x.formula = '';
      draft.sources.push(x);
      return x;
    }
    const goSource = n => { state.tab = 'map'; state.open = 's:' + n; paintSub(); paintPane(); };


    /* Which files of this form's media list a Media field or Read first shows: tag ← where its value comes from
     * (a field, a source's ID, or a fixed value), written as where: { die: "dieNo", kind: "\"setup sheet\"" }. */
    function mediaWhere(v, write) {
      const box = el('div', 'ffe-group');
      const rows = Object.entries(v || {}).map(([tag, from]) => ({ tag, from }));
      const list = FP.media ? FP.media.listOf(subOf ? subOf.master : draft) : [];
      const tagNames = Array.from(new Set(list.flatMap(m => Object.keys(m.tags || {})))).sort();
      const out = () => { const o = {}; rows.filter(r => r.tag && r.from).forEach(r => { o[r.tag] = r.from; }); write(Object.keys(o).length ? o : undefined); };
      const fromOpts = () => [['', 'this form\'s…']].concat(
        (draft.fields || []).filter(f => f.name).map(f => [f.name, `field ${f.label || f.name}`]),
        (draft.sources || []).filter(x => x && x.name && x.kind !== 'value').map(x => [x.name + '.$id', `${x.name} (its ID)`]),
        (draft.sources || []).filter(x => x && x.name && x.kind === 'value').map(x => [x.name, `${x.name} (worked out)`]));
      const valuesOf = tag => Array.from(new Set(list.flatMap(m => [].concat((m.tags || {})[tag] || []))));
      function paint() {
        box.replaceChildren();
        if (!list.length) box.appendChild(el('div', 'fpe-hint', 'This form has no media yet: attach files under Media on the form\'s map first.'));
        box.appendChild(el('div', 'fpe-hint', rows.length ? 'The files of this form\'s media list tagged:' : 'Every file of this form\'s media list. + only the ones tagged… narrows it, e.g. die is the Die no. field.'));
        rows.forEach((r, i) => {
          const line = el('div', 'fpe-row');
          const ts = select([['', 'tag…']].concat(tagNames.concat(r.tag && !tagNames.includes(r.tag) ? [r.tag] : []).map(t => [t, t])), r.tag);
          ts.onchange = () => { r.tag = ts.value; out(); };
          const fixed = /^".*"$/.test(r.from || '');
          const known = fromOpts().some(([k]) => k && k === r.from);
          const fs = select(fromOpts().concat([['__fixed', 'a fixed value…'], ['__fx', 'a formula…']]), fixed ? '__fixed' : known || !r.from ? r.from || '' : '__fx');
          const fv = input(fixed ? JSON.parse(r.from) : !known && r.from ? r.from : '', { placeholder: fixed ? 'value' : 'formula' });
          const dl = el('datalist'); dl.id = `mw-${Math.random().toString(36).slice(2)}`; valuesOf(r.tag).forEach(x => { const o = el('option'); o.value = x; dl.appendChild(o); }); fv.setAttribute('list', dl.id);
          fv.hidden = !(fixed || (!known && r.from));
          fs.onchange = () => {
            if (fs.value === '__fixed') { fv.hidden = false; fv.placeholder = 'value'; r.from = JSON.stringify(fv.value || ''); }
            else if (fs.value === '__fx') { fv.hidden = false; fv.placeholder = 'formula'; r.from = fv.value; }
            else { fv.hidden = true; r.from = fs.value; }
            out();
          };
          fv.oninput = () => { r.from = fs.value === '__fixed' ? JSON.stringify(fv.value) : fv.value; out(); };
          line.append(ts, el('span', 'fpe-hint', 'is'), fs, fv, dl, btn('✕', 'small', () => { rows.splice(i, 1); out(); paint(); }));
          box.appendChild(line);
        });
        box.appendChild(btn('+ only the ones tagged…', 'small', () => { rows.push({ tag: tagNames.find(t => !rows.some(r => r.tag === t)) || '', from: '' }); paint(); }));
      }
      paint();
      return box;
    }

    /* ---------- One setting, as an input, by its type in the catalog ---------- */
    function settingInput(x, obj, onChange, opts) {
      opts = opts || {};
      const v = obj[x.name];
      const set = val => { if (val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length)) delete obj[x.name]; else obj[x.name] = val; onChange(); };
      const wrap = el('label', 'ffe-set');
      const head = el('span', null, x.label + (x.required ? ' *' : ''));
      if (x.help && x.type !== 'target') { head.appendChild(document.createTextNode(' ')); head.appendChild(el('em', null, '· ' + x.help)); }
      // A field's starting value (0.57): typed the way the field takes it, never as JSON.
      if (x.name === 'default' && opts.field) {
        const f = opts.field, d = FP.forms.describe(f.control) || {}, kindOf = String(d.value || '');
        const opts2 = (Array.isArray(f.options) ? f.options : []).map(o => (o && typeof o === 'object' ? [String(o.value), o.label != null ? String(o.label) : String(o.value)] : [String(o), String(o)]));
        if (/^(paths|the path|a list of rows|the item ID|the person|seconds)/.test(kindOf)) return el('span');
        if (/list of the options/.test(kindOf)) {
          const i = input(Array.isArray(v) ? v.join(', ') : '', { placeholder: 'options, separated by commas' });
          i.oninput = () => set(i.value.split(',').map(t => t.trim()).filter(Boolean));
          wrap.append(head, i); return wrap;
        }
        if (opts2.length) {
          const sel = select([['', '(none)']].concat(opts2), v == null ? '' : String(v));
          // The options may change above while this is open: read them again when it is opened.
          sel.onfocus = sel.onmousedown = () => {
            const cur = sel.value;
            const now = (Array.isArray(f.options) ? f.options : []).map(o => (o && typeof o === 'object' ? [String(o.value), o.label != null ? String(o.label) : String(o.value)] : [String(o), String(o)]));
            sel.replaceChildren(...[['', '(none)']].concat(now).map(([val, t]) => { const o = document.createElement('option'); o.value = val; o.textContent = t; return o; }));
            sel.value = now.some(([val]) => val === cur) ? cur : '';
          };
          sel.onchange = () => { const o = (f.options || []).find(o2 => String(o2 && typeof o2 === 'object' ? o2.value : o2) === sel.value); set(sel.value === '' ? undefined : o && typeof o === 'object' ? o.value : o); };
          wrap.append(head, sel); return wrap;
        }
        if (/true or false/.test(kindOf)) {
          const sel = select([['', '(none)'], ['yes', 'Yes'], ['no', 'No']], v === true ? 'yes' : v === false ? 'no' : '');
          sel.onchange = () => set(sel.value === '' ? undefined : sel.value === 'yes');
          wrap.append(head, sel); return wrap;
        }
        const type = /number/.test(kindOf) ? 'number' : /^a date and time/.test(kindOf) ? 'datetime-local' : /^a date/.test(kindOf) ? 'date' : /^a time/.test(kindOf) ? 'time' : 'text';
        const i = input(v == null ? '' : String(v), type === 'number' ? { type, step: 'any' } : { type });
        i.oninput = () => set(i.value === '' ? undefined : type === 'number' ? Number(i.value) : i.value);
        wrap.append(head, i); return wrap;
      }
      switch (x.type) {
        case 'boolean': {
          // A setting that is on unless turned off (Required on a read-first item) keeps only the "off".
          const c = el('label', 'ffe-check'); const i = input('', { type: 'checkbox' }); i.checked = v === undefined ? !!x.default : !!v;
          i.onchange = () => set(i.checked === !!x.default ? undefined : i.checked);
          c.append(i, document.createTextNode(x.label + (x.help ? ` (${x.help})` : '')));
          return c;
        }
        case 'number': case 'integer': {
          const i = input(v == null ? '' : v, { type: 'number', step: x.type === 'integer' ? 1 : 'any' }); if (x.min != null) i.min = x.min;
          i.oninput = () => set(i.value === '' ? undefined : (x.type === 'integer' ? Math.round(Number(i.value)) : Number(i.value)));
          wrap.append(head, i); return wrap;
        }
        case 'numberOrFormula': {
          // A number, or a formula worked out on the form (profile.lengthIn - 0.25): a number stays a number.
          const i = input(v == null ? '' : typeof v === 'number' ? String(v) : '= ' + v, { placeholder: 'a number, or = a formula' });
          i.oninput = () => {
            const t = i.value.trim().replace(/^=\s*/, '');
            set(t === '' ? undefined : /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : t);
          };
          wrap.append(head, i); return wrap;
        }
        case 'choice': case 'tone': {
          const opts2 = (x.type === 'tone' ? FP.forms.TONES : x.options).map(o => [o, o]);
          const s = select([['', '(default)']].concat(opts2), v == null ? '' : v);
          s.onchange = () => set(s.value || undefined);
          wrap.append(head, s); return wrap;
        }
        case 'texts': {
          const i = input(Array.isArray(v) ? v.join(', ') : '', { placeholder: 'separated by commas' });
          i.oninput = () => set(i.value.split(',').map(t => t.trim()).filter(Boolean));
          wrap.append(head, i); return wrap;
        }
        case 'options': {
          // One option per line; "value = label" when it should read differently (P = Pass). Typed on one line with
          // commas ("Press 1, Press 2"), the commas separate them.
          const plainObj = o => o && typeof o === 'object' && Object.keys(o).every(k => ['value', 'label'].includes(k));
          const lineOf = o => (typeof o === 'object' ? (o.label != null && String(o.label) !== String(o.value) ? `${o.value} = ${o.label}` : String(o.value)) : String(o));
          const t = el('textarea'); t.placeholder = 'One option per line, or value = label';
          t.value = Array.isArray(v) ? v.filter(o => typeof o !== 'object' || plainObj(o)).map(lineOf).join('\n') : '';
          const hint = el('div', 'fpe-hint');
          t.oninput = () => {
            let lines = t.value.split('\n').map(o => o.trim()).filter(Boolean);
            const split = lines.length === 1 && lines[0].includes(',') && !lines[0].includes('=');
            if (split) lines = lines[0].split(',').map(o => o.trim()).filter(Boolean);
            set(lines.map(l => { const m = /^(.*?)\s+=\s+(.+)$/.exec(l); return m ? { value: m[1].trim(), label: m[2].trim() } : l; }));
            hint.textContent = split ? `${lines.length} options, split at the commas.` : '';
          };
          wrap.append(head, t, hint); return wrap;
        }
        case 'formula': {
          const fx = formulaInput(v || '', f => set(f || undefined), x.help ? '' : 'formula', formulaHelp(!!(opts.field && opts.field.control === 'buttons' && ['caption', 'tone'].includes(x.name)), x.names));
          wrap.append(head, fx);
          return wrap;
        }
        case 'target': wrap.append(head, targetPicker(obj, x.name, onChange, opts.field)); return wrap;
        case 'form': {
          const s = select([['', '—']].concat(FP.defs.list('form').filter(d => !d.retired && d.id !== ctx.id).map(d => [d.id, `${(d.def && d.def.title) || d.id} (${d.id})`])), v || '');
          s.onchange = () => set(s.value || undefined);
          wrap.append(head, s); return wrap;
        }
        case 'structure': {
          const s = select([['', '—']].concat(FP.defs.list('structure').filter(d => !d.retired).map(d => [d.id, (d.def && d.def.label) || d.id])), v || '');
          s.onchange = () => set(s.value || undefined);
          wrap.append(head, s); return wrap;
        }
        case 'field': {
          const s = select([['', '—']].concat(draft.fields.map(f => [f.name, `${f.label || f.name} (${f.name})`])), v || '');
          s.onchange = () => set(s.value || undefined);
          wrap.append(head, s); return wrap;
        }
        case 'object': {
          const g = el('div', 'ffe-group');
          const sub2 = Object.assign({}, v || {});
          (x.of || []).forEach(o => g.appendChild(settingInput(o, sub2, () => set(Object.keys(sub2).length ? Object.assign({}, sub2) : undefined))));
          wrap.append(head, g); return wrap;
        }
        case 'map': {
          // A Media field's or Read first's files: picked by tag from the form's media list.
          if (x.name === 'where') { if (obj.show === 'text') return el('span'); const w = el('div', 'ffe-set'); w.append(head, mediaWhere(v, set)); return w; }
          const g = el('div', 'ffe-group');
          const m = Object.assign({}, v || {});
          const paintMap = () => {
            g.replaceChildren();
            Object.entries(m).forEach(([k, val]) => {
              const r = el('div', 'fpe-row');
              let key = k;   // follows the name box as you type, so nothing is rebuilt under you
              const ki = input(/^name\d+$/.test(k) && val === (x.values === 'tone' ? 'good' : '') ? '' : k, { placeholder: 'name' }); ki.style.flex = '1 1 120px';
              const vi = x.values === 'tone' ? select(FP.forms.TONES.map(o => [o, o]), val) : input(typeof val === 'string' ? val : JSON.stringify(val), { placeholder: 'value' });
              vi.style.flex = '1 1 120px';
              const save = () => { const out = {}; Object.keys(m).forEach(n => { if (!/^name\d+$/.test(n) || n === key && ki.value.trim()) out[n] = m[n]; }); set(Object.keys(out).length ? out : undefined); };
              ki.oninput = () => {
                const to = ki.value.trim();
                if (!to || (to !== key && m[to] != null)) return;   // blank, or already a row: wait
                const next = {}; Object.keys(m).forEach(n => { next[n === key ? to : n] = m[n]; });
                Object.keys(m).forEach(n => delete m[n]); Object.assign(m, next); key = to; save();
              };
              vi.oninput = vi.onchange = () => { m[key] = vi.value; save(); };
              r.append(ki, vi, btn('✕', 'small', () => { delete m[key]; save(); paintMap(); }));
              g.appendChild(r);
            });
            g.appendChild(btn('Add', 'small', () => { let k = 'name', i = 1; while (m[k + i] != null) i++; m[k + i] = x.values === 'tone' ? 'good' : ''; paintMap(); }));
          };
          paintMap();
          wrap.append(head, g); return wrap;
        }
        case 'name': case 'kind': case 'text': {
          const i = input(v == null ? '' : v, { spellcheck: x.type === 'text' });
          const err = el('div', 'err');
          i.oninput = () => {
            const val = i.value;
            if (x.type === 'name' && val && !NAME_RE.test(val)) { err.textContent = 'Letters, digits and _, starting with a letter.'; i.classList.add('bad'); return; }
            err.textContent = ''; i.classList.remove('bad'); set(val === '' ? undefined : val);
          };
          wrap.append(head, i, err); return wrap;
        }
        case 'list': if (x.of) {
          // A list of settings (0.55: a trace tree's branches, a table's columns): one card each, its settings in it.
          const box = el('div', 'ffe-set');
          const g = el('div', 'ffe-group');
          // A bare word (a fixed row's name) is that one setting; saved back as the word when nothing else is set.
          const arr = Array.isArray(v) ? v.map(o => (o && typeof o === 'object' ? Object.assign({}, o) : x.strings && typeof o === 'string' ? { [x.strings]: o } : {})) : [];
          const bare = o => x.strings && Object.keys(o).length === 1 && typeof o[x.strings] === 'string';
          const save = () => set(arr.length ? arr.map(o => (bare(o) ? o[x.strings] : Object.assign({}, o))) : undefined);
          const paintList = () => {
            g.replaceChildren();
            arr.forEach((o, i) => {
              const card = el('div', 'ffe-group ffe-li');
              const top = el('div', 'fpe-row');
              top.append(el('b', null, o.label || o.name || o.key || `${x.label} ${i + 1}`),
                btn('↑', 'small', () => { if (i) { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); save(); paintList(); } }),
                btn('↓', 'small', () => { if (i < arr.length - 1) { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); save(); paintList(); } }),
                btn('Remove', 'small', () => { arr.splice(i, 1); save(); paintList(); }));
              card.appendChild(top);
              x.of.forEach(s2 => card.appendChild(settingInput(s2, o, save)));
              g.appendChild(card);
            });
            g.appendChild(btn('+ Add', 'small', () => { arr.push({}); paintList(); }));
          };
          paintList();
          box.append(head, g); return box;
        }
        // falls through: a list without settings of its own is written as JSON
        default: {
          // list, any: as JSON (a starting value, chart series, and the like)
          const t = el('textarea'); t.placeholder = 'Written as JSON, e.g. 5 or "text" or [1, 2]';
          t.value = v === undefined ? '' : JSON.stringify(v, null, 1);
          const err = el('div', 'err');
          t.oninput = () => {
            if (!t.value.trim()) { err.textContent = ''; set(undefined); return; }
            try { set(JSON.parse(t.value)); err.textContent = ''; } catch (e) { err.textContent = 'Not valid yet: ' + e.message; }
          };
          wrap.append(head, t, err); return wrap;
        }
      }
    }

    /* ---------- Where a value saves: a one-item source, and a container of its structure ---------- */
    function targetPicker(obj, key, onChange, field) {
      const box = el('div');
      let choosing = false;
      const guessFor = st => {
        const names = containersOf(st);
        const worked = new Set(names.filter(([, k]) => k !== 'container').map(([n]) => n));
        return field && !worked.has(field.name) ? field.name : ((names.find(([, k]) => k === 'container') || [])[0] || 'value');
      };
      const saveTo = (x, container) => {
        const c = container || guessFor(x.structure);
        obj[key] = `${x.name}.${c}`;
        setUse(x, c, reads(useOf(x, c)), true);   // saving to it ticks it write on the source
        onChange(); paint();
      };
      const paint = () => {
        box.replaceChildren();
        const cur = target(obj[key]);
        const src = cur && srcByName(cur.structure);
        const r = el('div', 'ffe-maprow');
        if (choosing) {
          // A new source: which structure's item?
          const structures = FP.defs.list('structure').filter(d => !d.retired && !FP.sources.BUILT_IN.includes(d.id));
          const ns = select([['', 'which structure?']].concat(structures.map(d => [d.id, `${(d.def && d.def.label) || d.id} (${d.id})`]), [['__new', '+ New structure…']]), '');
          ns.onchange = async () => {
            if (!ns.value) return;
            choosing = false;
            if (ns.value === '__new') {
              const id = prompt('Name of the new structure (lowercase letters, digits and -, e.g. od-checks):');
              if (!id || !SLUG_RE.test(id.trim())) { if (id) toast('That name won\'t do: lowercase letters, digits and -.', true); paint(); return; }
              const r2 = await FP.editor.editStructure(id.trim(), { container: field ? field.name : 'value' });
              if (r2) saveTo(addSource('item', r2.id), r2.container || (field ? field.name : 'value')); else paint();
              return;
            }
            saveTo(addSource('item', ns.value));
          };
          r.append(ns, btn('Cancel', 'small', () => { choosing = false; paint(); }));
          box.appendChild(r);
          return;
        }
        const its = itemSources().filter(x => x.structure && !FP.sources.BUILT_IN.includes(x.structure));
        const opts = [['', subOf ? 'nowhere (only sent back, or read by name)' : 'nowhere (only on the submission record)']].concat(its.map(x => [x.name, `${x.name}: ${x.structure}`]));
        if (cur && !src) opts.push([cur.structure, `${cur.structure} (not a source of this form)`]);
        opts.push(['__new', '+ New source…']);
        const ss = select(opts, cur ? cur.structure : '');
        r.appendChild(ss);
        if (cur && src) {
          const names = containersOf(src.structure).filter(([, k]) => k === 'container').map(([n]) => n);
          if (!names.includes(cur.container)) names.push(cur.container);
          const cs = select(names.map(n => [n, n]).concat([['__new', '+ New container…']]), cur.container);
          r.appendChild(cs);
          cs.onchange = async () => {
            if (cs.value !== '__new') { saveTo(src, cs.value); return; }
            const r2 = await FP.editor.editStructure(src.structure, { container: field ? field.name : '' });
            if (r2 && r2.container) saveTo(src, r2.container); else paint();
          };
        }
        ss.onchange = () => {
          if (ss.value === '') { delete obj[key]; onChange(); paint(); return; }
          if (ss.value === '__new') { choosing = true; paint(); return; }
          const x = srcByName(ss.value);
          if (x) saveTo(x);
        };
        box.appendChild(r);
        if (src) {
          const note = el('div', 'ffe-id');
          note.append(document.createTextNode(`The ${idLabel(src.structure)} ${src.id && src.id.generate ? 'is made new each save' : src.id && src.id.field ? `comes from the field ${(byName(src.id.field) || {}).label || src.id.field}` : src.id && src.id.fixed ? `is always ${src.id.fixed}` : "hasn't been chosen"}`.replace(/\.?$/, '. ')), btn('Change it on the map ›', 'small', () => { state.tab = 'map'; state.open = 'id:' + src.name; paintSub(); paintPane(); }));
          box.appendChild(note);
        }
      };
      paint();
      return box;
    }

    const savers = x => draft.fields.filter(f => [f.writes, f.snapshot].some(w => { const t = target(w); return t && t.structure === x.name; }));
    const itemSaved = x => savers(x).length > 0;

    /* ---------- What each source holds, and who fills or shows each value ---------- */
    const KIND_COLOR = { item: '#0e7490', items: '#0891b2', value: '#7c3aed' };
    const isList = x => x.kind === 'items';
    const whichText = x => (x.kind === 'items' ? `${x.open ? 'the open ones' : 'all'}${x.filter ? ` where ${x.filter}` : x.open ? '' : ' of them'}` : idText(x));
    const describeSource = x => (x.kind === 'value' ? `formula = ${x.formula || '?'}` : `${x.structure || 'choose a structure'} · ${isList(x) ? 'list' : '1 item'}: ${whichText(x)}`);
    const useOf = (x, c) => ((x.values || {})[c] || null);
    const reads = u => u === 'read' || u === 'both';
    const writes = u => u === 'write' || u === 'both';
    function setUse(x, c, r, w) {
      x.values = x.values || {};
      const u = r && w ? 'both' : r ? 'read' : w ? 'write' : null;
      if (u) x.values[c] = u; else delete x.values[c];
    }
    const humanize = n => String(n).replace(/^\$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, ch => ch.toUpperCase());
    const tokensOf = f => (FP.fn.scan ? FP.fn.scan(String(f || '')) : []);
    // Fields that read source.value in a formula, or show it as a column of a list's table.
    const readersOf = (x, c) => draft.fields.filter(f => (['formula', 'when', 'optionsFrom'].some(k => f[k] && tokensOf(f[k]).some(t => t.type === 'name' && t.text.split('.')[0] === x.name && t.text.split('.')[1] === c)))
      || (f.rowsFrom === x.name && (f.columns || []).some(col => col && col.name === c && !col.edit)));
    // Fields that fill source.value: an entry field saving to it, a display field copying to it, or an editable column.
    const fillersOf = (x, c) => draft.fields.filter(f => [f.writes, f.snapshot].some(w => w === `${x.name}.${c}`)
      || (f.rowsFrom === x.name && (f.columns || []).some(col => col && col.name === c && col.edit)));
    const readersOfSource = x => draft.fields.filter(f => ['formula', 'when', 'optionsFrom'].some(k => f[k] && tokensOf(f[k]).some(t => t.type === 'name' && t.text.split('.')[0] === x.name)) || f.rowsFrom === x.name);
    const guessControl = (st, c) => {
      const d = FP.defs.get('structure', st);
      const spec = d && d.def && d.def.containers && d.def.containers[c];
      if (spec && spec.rule && ['sum', 'count', 'average', 'min', 'max'].includes(spec.rule)) return 'number';
      if (/date$/i.test(c)) return 'date';
      if (/^(is|has)[A-Z]/.test(c)) return 'toggle';
      return /qty|count|speed|weight|length|width|height|od$|temp|pct|percent|rate|time$/i.test(c) ? 'number' : 'text';
    };
    function placeField(f) {
      draft.fields.push(f);
      if (Array.isArray(draft.layout)) draft.layout.push([f.name]);
      return f;
    }
    function makeFiller(x, c) {
      if (isList(x)) return tableColumn(x, c, true);
      const label = humanize(c);
      return placeField({ name: nameFrom(label, takenNames()), label, control: guessControl(x.structure, c), writes: `${x.name}.${c}` });
    }
    function makeReader(x, c) {
      if (isList(x)) return tableColumn(x, c, false);
      const label = humanize(c);
      return placeField({ name: nameFrom(label, takenNames()), label, control: 'value', formula: `${x.name}.${c}` });
    }
    // The table showing a list source: one row per item, a column per value.
    function tableColumn(x, c, edit) {
      let t = draft.fields.find(f => f.rowsFrom === x.name);
      if (!t) t = placeField({ name: nameFrom(`${x.name} table`, takenNames()), label: humanize(x.name), control: 'table', rowsFrom: x.name, columns: [] });
      t.columns = Array.isArray(t.columns) ? t.columns : [];
      let col = t.columns.find(k => k && k.name === c);
      if (!col) { col = { name: c, label: humanize(c) }; t.columns.push(col); }
      if (edit) col.edit = true;
      return t;
    }
    function unfill(x, c) {
      fillersOf(x, c).forEach(f => {
        ['writes', 'snapshot'].forEach(k => { if (f[k] === `${x.name}.${c}`) delete f[k]; });
        if (f.rowsFrom === x.name) (f.columns || []).forEach(col => { if (col && col.name === c) delete col.edit; });
      });
    }

    /* A source's name follows its structure while it hasn't been named by hand: rack for one item, racks for a list. */
    const singular = st => String(st).replace(/(^|[-_ ])([a-z]{1,2})ies$/i, '$1$2ie').replace(/([a-z]{3,})ies$/i, '$1y').replace(/(ss)$/, '$1').replace(/([^s])s$/, '$1');
    const autoNames = x => [FP.sources.nameFor(x.structure || 'item', new Set()), FP.sources.nameFor(singular(x.structure || 'item'), new Set()), 'item', 'items', 'data'];
    const isAutoName = x => autoNames(x).some(n => new RegExp(`^${n}\\d*$`).test(x.name));
    function renameAuto(x, wasAuto) {
      if (!wasAuto || !x.structure) return;
      const base = isList(x) ? x.structure : singular(x.structure);
      const to = FP.sources.nameFor(base, new Set(Array.from(takenNames()).filter(n => n !== x.name)));
      if (to !== x.name) { renameSource(draft, x.name, to); x.name = to; }
      state.open = 's:' + x.name;
    }

    /* ---------- Problems, each placed on the part of the map it is about ---------- */
    const MARKED = /^(form$|s:|id:|v:|f:|b:|a:|sf:)/;
    const marks = new Map();   // row key -> { mark, errs, row }
    let problems = ctx.problems || [];
    function problemKey(t) {
      let m;
      const fieldBy = n => draft.fields.find(f => f.name === n || f.label === n);
      if ((m = /^Sub-form ([A-Za-z0-9_]+)/.exec(t))) return 'sf:' + m[1];
      if ((m = /^Field ([A-Za-z0-9_]+)/.exec(t)) && fieldBy(m[1])) return 'f:' + fieldBy(m[1]).name;
      if ((m = /^Layout: required field ([A-Za-z0-9_]+)/.exec(t)) && fieldBy(m[1])) return 'f:' + m[1];
      if ((m = /^Button ([A-Za-z0-9_]+)/.exec(t))) return Array.isArray(draft.buttons) ? 'b:' + m[1] : 'b:__one';
      if ((m = /^Read before starting ([A-Za-z0-9_]+)/.exec(t))) { const i = (draft.acknowledge || []).findIndex(a => a && a.name === m[1]); if (i >= 0) return 'a:' + i; }
      if ((m = /^Source ([A-Za-z0-9_]+)/.exec(t)) && srcByName(m[1])) return /which item|the one where|\bid\b/i.test(t) && srcByName(m[1]).kind !== 'value' ? 'id:' + m[1] : 's:' + m[1];
      if ((m = /(\w+) isn't ticked write on (\w+)/.exec(t)) && srcByName(m[2])) return `v:${m[2]}:${m[1]}`;
      if ((m = /^items\.([a-z0-9-]+)/.exec(t)) || (m = /^([a-z0-9-]+) IDs are/.exec(t))) { const x = draft.sources.find(y => y.structure === m[1] && y.kind === 'item'); if (x) return 'id:' + x.name; }
      if ((m = /^(.+?) (both|all) save to/.exec(t))) { const f = fieldBy(m[1].split(' and ')[0]); if (f) return 'f:' + f.name; }
      // A field named at the start: "Measured OD saves to …", "notes: …"
      const lead = draft.fields.filter(f => [f.label, f.name].filter(Boolean).some(n => t.startsWith(n + ' ') || t.startsWith(n + ':')))
        .sort((a, b) => String(b.label || b.name).length - String(a.label || a.name).length)[0];
      if (lead) return 'f:' + lead.name;
      return 'form';
    }
    const byKey = () => { const out = new Map(); problems.forEach(t => { const k = problemKey(t); if (!out.has(k)) out.set(k, []); out.get(k).push(t); }); return out; };
    /* Which tab of the outline a row is on (0.58). A button is on Fields where it sits on the form, else on Form. */
    const placedNow = () => placedNames(Array.isArray(draft.layout) ? draft.layout : draft.fields.map(f => [f.name]));
    function tabFor(key) {
      key = String(key || '');
      if (/^(s:|id:|v:|\+v:|\+s$|r:)/.test(key)) return 'data';
      if (/^(f:|\+f$)/.test(key)) return 'fields';
      if (/^b:/.test(key)) return placedNow().has(key.slice(2)) && state.left !== 'form' ? 'fields' : 'form';
      return 'form';
    }
    const TABS = [['fields', 'Fields'], ['data', 'Data'], ['form', 'Form']];
    function paintTabs() {
      const by = byKey();
      const bad = { fields: 0, data: 0, form: 0 };
      by.forEach((list, k) => { bad[tabFor(k)] += list.length; });
      tabsBar.replaceChildren(...TABS.map(([k, t]) => {
        const b = btn(t + (bad[k] ? ` ✗${bad[k]}` : ''), 'ffe3-tab' + (state.left === k ? ' on' : '') + (bad[k] ? ' bad' : ''), () => { if (state.left === k) return; state.left = k; state.block = null; hard(); });
        b.dataset.tab = k; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(state.left === k));
        if (bad[k]) b.title = `${bad[k]} to fix on ${t}`;
        return b;
      }));
    }
    function paintMarks() {
      const by = byKey();
      paintTabs();
      // A problem whose row isn't on its tab goes on the form's own row (on Form) or the tab's count.
      by.forEach((list, k) => { if (k !== 'form' && !marks.has(k) && tabFor(k) === state.left && state.left === 'form') { if (!by.has('form')) by.set('form', []); by.get('form').push(...list); by.delete(k); } });
      marks.forEach(({ mark, errs, row }, k) => {
        const mine = by.get(k) || [];
        mark.textContent = mine.length ? '✗' : '✓';
        mark.className = 'ffm-mark ' + (mine.length ? 'bad' : 'ok');
        mark.title = mine.length ? mine.join('\n') : 'Nothing to fix';
        row.classList.toggle('has-err', !!mine.length);
        // Under its own row, the "Field qty:" at the front says nothing new.
        const short = x => x.replace(/^(Field|Button|Source|Read before starting) [A-Za-z0-9_]+:\s*/, '').replace(/^(Field|Button|Source|Read before starting) [A-Za-z0-9_]+ /, '').replace(/^./, c => c.toUpperCase());
        errs.replaceChildren(...mine.map(x => el('div', null, '✗ ' + short(x))));
        errs.hidden = !mine.length;
      });
    }
    ctx.problemsChanged = list => { problems = list || []; paintMarks(); };
    ctx.goToProblem = () => {
      const by = byKey();
      const keys = Array.from(by.keys());
      const k = keys.find(x => tabFor(x) === state.left) || keys[0] || 'form';
      state.left = tabFor(k); state.block = null; state.open = k; paintSub(); paintPane(); markSelected();
      const r = pane.querySelector(`.ffm-r[data-key="${window.CSS.escape(k)}"]`);
      if (r) r.scrollIntoView({ block: 'center' });
    };

    /* ---------- The map: the whole form as one outline, each row opening its settings in place ---------- */
    let soft = () => {}, hard = () => {};
    // Rows are keyed by name; a field renamed as its label is typed keeps its row (no repaint mid-typing), so the
    // row's old key is followed to the new one.
    const renamedKeys = new Map();
    const keyNow = key => { let k = key, n = 0; while (renamedKeys.has(k) && n++ < 20) k = renamedKeys.get(k); return k; };
    const renamedRow = (from, to) => {
      if (from === to) return;
      renamedKeys.delete(to); renamedKeys.set(from, to);
      document.querySelectorAll(`.ffm-r[data-key="${window.CSS.escape(from)}"]`).forEach(r => { r.dataset.key = to; });
    };
    const open = key => { key = keyNow(key); state.open = state.open === key ? null : key; hard(); };

    /* Settings of one source. */
    function sourceProps(x, box) {
      const nm = el('label', 'ffe-set'); const nh = el('span', null, 'Name '); nh.appendChild(el('em', null, '· used in formulas; letters, digits and _'));
      const ni = input(x.name, { spellcheck: false }); const ne = el('div', 'err');
      ni.onchange = () => {
        const to = ni.value.trim();
        if (to === x.name) return;
        if (!NAME_RE.test(to) || to.toLowerCase() === 'form') { ne.textContent = 'Letters, digits and _, starting with a letter (not form).'; ni.value = x.name; return; }
        if (takenNames().has(to)) { ne.textContent = 'A field, button or source has that name.'; ni.value = x.name; return; }
        renameSource(draft, x.name, to); x.name = to; state.open = 's:' + to; changed(); hard();
      };
      nm.append(nh, ni, ne); box.appendChild(nm);
      // Carried values (0.50; edited here since 0.57): copied from this item onto the item another source saves.
      if (x.kind === 'item') {
        if (x.carry && !Array.isArray(x.carry)) x.carry = [x.carry];
        (x.carry || []).forEach(c => { if (c && Array.isArray(c.values)) c.values = Object.fromEntries(c.values.map(n => [String(n), String(n)])); });
        const others = (draft.sources || []).filter(o => o && o.kind === 'item' && o.name !== x.name).map(o => o.name);
        if (others.length || x.carry) box.appendChild(settingInput({ name: 'carry', type: 'list', label: 'Carries onto the record',
          help: 'Values copied from this item onto the item another source saves, e.g. a run\'s shift and line onto each rack.', of: [
            { name: 'to', type: 'choice', label: 'Onto', options: others, required: true },
            { name: 'values', type: 'map', label: 'Values', values: 'text', help: 'Its value ← this item\'s value, or = a formula. Blank: the same name.' },
            { name: 'when', type: 'formula', label: 'Only when' }] }, x, () => { changed(); soft(); }));
      }
      if (x.kind === 'value') {
        const fl = el('label', 'ffe-set'); fl.appendChild(el('span', null, 'Formula'));
        fl.appendChild(formulaInput(x.formula || '', v => { x.formula = v; changed(); soft(); }, 'e.g. CurrentSpec(profile, "od")', formulaHelp()));
        box.appendChild(fl);
        if (FP.editor.editFunction) box.appendChild(btn('+ Read from a structure…', 'small', async () => {
          const name = prompt('Name of the new lookup (letters and digits, e.g. OpenOrders):');
          if (!name || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name.trim())) { if (name) toast('That name won\'t do: letters, digits and _.', true); return; }
          const r2 = await FP.editor.editFunction(name.trim(), { lookup: true });
          if (r2) { const fn = FP.fn.get(r2.id); x.formula = `${r2.id}(${((fn && fn.inputs) || []).map(i => i.name).join(', ')})`; changed(); hard(); }
        }));
      } else {
        const own = FP.defs.list('structure').filter(d => !d.retired).map(d => [d.id, `${(d.def && d.def.label) || d.id} (${d.id})`]);
        const built = [['users', 'Users (built in; PINs are never read)'], ['sites', 'Sites (built in)']];
        const sl = el('label', 'ffe-set'); sl.appendChild(el('span', null, 'Structure'));
        const ss = select([['', 'choose a structure…']].concat(own, built, [['__new', '+ New structure…']]), x.structure || '');
        if (!x.structure) ss.classList.add('bad');
        ss.onchange = async () => {
          let st = ss.value;
          if (st === '__new') {
            const id = prompt('Name of the new structure (lowercase letters, digits and -, e.g. speed-tests):');
            if (!id || !SLUG_RE.test(id.trim())) { if (id) toast('That name won\'t do: lowercase letters, digits and -.', true); hard(); return; }
            const r2 = await FP.editor.editStructure(id.trim(), {});
            if (!r2) { hard(); return; }
            st = r2.id;
          }
          const wasAuto = isAutoName(x);
          x.structure = st || '';
          x.values = {};
          if (!isList(x)) x.id = st ? defaultId(st) : {};
          renameAuto(x, wasAuto);
          if (st) state.open = 'id:' + x.name;
          changed(); hard();
        };
        sl.appendChild(ss); box.appendChild(sl);
        if (x.structure) box.appendChild(el('div', 'fpe-hint', `Which ${idLabel(x.structure)} this form works with is set on the ID row under it.`));
        if (x.structure && x.kind === 'item') {
          // Fill in from it (0.60): the fields saving to it start at the item's values.
          const fc = el('label', 'ffe-check'); const fi2 = input('', { type: 'checkbox' }); fi2.checked = !!x.fill;
          fi2.onchange = () => { if (fi2.checked) x.fill = true; else delete x.fill; changed(); hard(); };
          fc.append(fi2, document.createTextNode(' Fill in the form from it: fields saving to it start at its values (pick another item and they follow)'));
          box.appendChild(fc);
          // The questions its kind brings (0.60): End the run, Cancel it, Closed, Shipped or used…
          const qs = FP.kinds ? FP.kinds.questions(x.structure).filter(q => !fillersOf(x, q.value).length) : [];
          if (qs.length) {
            const g = el('div', 'ffe-set'); g.appendChild(el('span', null, 'Questions its kind brings'));
            const row = el('div', 'ffe-qs');
            qs.forEach(q => row.appendChild(btn(`+ ${q.field.label}`, 'small', () => {
              setUse(x, q.value, useOf(x, q.value) ? reads(useOf(x, q.value)) : false, true);
              const f = placeField(Object.assign({ name: nameFrom(q.field.label, takenNames()) }, JSON.parse(JSON.stringify(q.field)), { writes: `${x.name}.${q.value}` }));
              state.open = 'f:' + f.name; changed(); hard();
            })));
            g.append(row, el('div', 'fpe-hint', `Each saves to the value that plays its part (${qs.map(q => `${q.roleLabel.toLowerCase()}: ${q.value}`).join('; ')}).`));
            box.appendChild(g);
          }
        }
      }
      const rd = readersOfSource(x);
      box.appendChild(el('div', 'fpe-hint', rd.length ? `Read by: ${rd.map(f => f.label || f.name).join(' · ')}` : 'No field reads it yet.'));
      box.appendChild(btn('Delete source', 'small', () => {
        const sv = draft.fields.filter(f => [f.writes, f.snapshot].some(w => { const t = target(w); return t && t.structure === x.name; }) || f.rowsFrom === x.name);
        if (!confirm(`Delete ${x.name}?${sv.length ? ` ${sv.length} field${sv.length === 1 ? '' : 's'} using it will save nowhere.` : ''} Formulas that read it will show a problem.`)) return;
        sv.forEach(f => { ['writes', 'snapshot'].forEach(k => { const t = target(f[k]); if (t && t.structure === x.name) delete f[k]; }); if (f.rowsFrom === x.name) delete f.rowsFrom; });
        (draft.buttons || []).forEach(b => { if (b && b.link === x.name) delete b.link; });
        draft.sources.splice(draft.sources.indexOf(x), 1);
        state.open = null; changed(); hard();
      }));
    }

    /* Which items: one (the one entered in a field, a new one each save, always the same) or a list (all, or all where…). */
    /* What a structure calls its IDs: Speed Record, Check no., or "rack ID". */
    const idLabel = st => { const r = idRule(st); return r.label === 'ID' ? `${singular(st)} ID` : r.label; };
    /* Where the ID comes from, in a few words, for the ID row. */
    function idSource(x) {
      if (isList(x)) return `${x.open ? 'the open ones' : 'every one'}${x.filter ? ` where ${x.filter}` : ''} · a list`;
      const id = x.id || {};
      if (id.field) { const f = byName(id.field); return `← ${f ? f.label || f.name : id.field}`; }
      if (id.generate) { const r = idRule(x.structure); return `made new each save${r.prefix ? ` (${r.prefix}-…)` : ''}`; }
      if (id.fixed) return `always ${id.fixed}`;
      if (id.where != null) return id.where ? `the latest where ${id.where}` : 'the latest where … (give the rule)';
      if (id.open != null) return openWords(id.open);
      return 'where does it come from? Tap to choose';
    }
    /* The ID row's settings: where the ID comes from, which picks the item (or items) every value under it belongs to. */
    function idProps(x, box) {
      const st = x.structure;
      const rule = idRule(st);
      const builtIn = FP.sources.BUILT_IN.includes(st);
      const label = idLabel(st);
      const id = x.id || {};
      const cur = isList(x) ? 'all' : id.field || state.idWant === x.name ? 'field' : id.fixed != null ? 'fixed' : id.where != null ? 'where' : id.open != null ? 'open' : id.generate ? 'new' : '';
      box.appendChild(el('p', 'ffe-note', `Every ${st} item has a ${label.replace(/\.$/, '')}. It picks the item: the values under it are that item's. Where does this form's ${label} come from?`));
      const entry = draft.fields.filter(f => isEntry(f) && !f.rowsFrom);
      const choose = v => {
        const wasAuto = isAutoName(x);
        state.idWant = v === 'field' ? x.name : null;   // "typed in a field", with the field still to pick
        if (v === 'all') { x.kind = 'items'; delete x.id; }
        else {
          if (isList(x)) {
            // From a list back to one item: its table goes, and fields save to the item instead.
            x.kind = 'item'; delete x.filter;
            draft.fields.filter(f => f.rowsFrom === x.name).forEach(f => { delete f.rowsFrom; });
          }
          if (v === 'new') x.id = { generate: true };
          else if (v === 'field') x.id = {};
          else if (v === 'fixed') x.id = { fixed: (x.id && x.id.fixed) || '' };
          else if (v === 'where') x.id = { where: (x.id && x.id.where) || x.filter || '' };
          else if (v === 'open') x.id = { open: (x.id && x.id.open) || {} };
          else if (v.startsWith('f:')) {
            x.id = { field: v.slice(2) };
            // The ID field must be filled in, or a save couldn't say which item.
            const f = byName(v.slice(2));
            if (f && !f.required) f.required = true;
          } else x.id = {};
        }
        renameAuto(x, wasAuto);
        state.open = 'id:' + x.name;
        changed(); hard();
      };
      const opt = (value, title, help, extra, off) => {
        const lab = el('label', 'ffm-opt' + (cur === value ? ' on' : '') + (off ? ' off' : ''));
        const r = input('', { type: 'radio', name: 'idfrom-' + x.name }); r.checked = cur === value; r.disabled = !!off;
        r.onchange = () => choose(value);
        const txt = el('span'); txt.append(el('b', null, title), el('small', null, off || help));
        lab.append(r, txt);
        if (extra && cur === value) lab.appendChild(extra);
        box.appendChild(lab);
      };
      const makeIdField = () => {
        const f = placeField({ name: nameFrom(label, takenNames()), label, control: 'text', required: true });
        draft.fields.splice(draft.fields.indexOf(f), 1); draft.fields.unshift(f);   // the ID goes first on the form
        if (Array.isArray(draft.layout)) { unplace(draft.layout, f.name); draft.layout.unshift([f.name]); }
        choose('f:' + f.name);
      };
      // Typed or scanned in a field
      const fx = el('div', 'ffm-optx');
      if (entry.length) {
        const fs = select([['', 'pick the field…']].concat(entry.map(f => [f.name, f.label || f.name])), id.field || '');
        if (!id.field) fs.classList.add('bad');
        fs.onchange = () => { if (fs.value) choose('f:' + fs.value); };
        fx.append(fs);
      }
      fx.appendChild(btn(`+ Make a ${label} field`, 'small', makeIdField));
      opt('field', 'Typed or scanned in a field', `The item whose ${label} someone types or scans. Saving adds to that item; reading shows it.`, fx, rule.made === 'new' ? `Not here: ${st} makes its ${label}s itself (its ID column says so).` : null);
      opt('new', 'Made new each save', `Each save starts a new item${rule.prefix ? `, ${rule.prefix}-…` : ''}: a log of checks, tests, receipts.`, null, builtIn ? `Not here: ${st} is built in.` : rule.made === 'entered' ? `Not here: ${st} says its IDs (${label}) are typed in: its ID column says so.` : null);
      const fix = el('div', 'ffm-optx');
      const fi = input(id.fixed || '', { placeholder: `the ${label}, e.g. A1`, spellcheck: false });
      fi.oninput = () => { x.id = { fixed: fi.value.trim() }; changed(); soft(); };
      fix.appendChild(fi);
      opt('fixed', 'Always the same one', 'One item every time: a settings or targets record.', fix, rule.made === 'new' ? `Not here: ${st} makes its ${label}s itself.` : null);
      // Found by a rule: the latest item that matches (the run on now, the open order for this line).
      const wx = el('div', 'ffm-optx');
      if (cur === 'where') {
        containersOf(st);
        const found = el('div', 'fpe-hint');
        let wt = null;
        const refind = () => {
          clearTimeout(wt);
          wt = setTimeout(async () => {
            if (!x.id || !x.id.where) { found.textContent = ''; return; }
            const v = await FP.sources.evaluate({ sources: [x] }, {}, {}).catch(e => ({ [x.name]: { __fp: 'error', message: e.message } }));
            const got = v[x.name];
            found.textContent = got && typeof got === 'object' && got.$id != null ? `Found now: ${got.$id}${/form\./.test(x.id.where) ? ' (with this form\'s fields blank)' : ''}` : FP.fn.isNoData(got) ? 'None matches right now: saving waits until one does.' : FP.fn.describe(got).text;
          }, 300);
        };
        wx.append(el('div', 'fpe-hint', 'The latest one where (names are the item\'s values, form.name is this form\'s):'), formulaInput(id.where || '', v2 => { x.id = { where: v2 }; changed(); soft(); refind(); }, 'e.g. AND(status = "Running", line = form.line)', filterHelp(st)), found);
        refind();
      }
      // The open one (0.60): by the structure's kind, the latest open item whose values match this form's fields.
      const ox = el('div', 'ffm-optx');
      if (cur === 'open') {
        const pairs = Object.entries(id.open || {});
        const vals = containersOf(st).map(([n]) => n);
        const fieldsHere = draft.fields.filter(f => f && f.name && f.control !== 'table');
        const put = list => { x.id = { open: Object.fromEntries(list.filter(([k, f]) => k && f)) }; changed(); soft(); };
        ox.appendChild(el('div', 'fpe-hint', 'Whose (optional; none: the latest open one):'));
        pairs.concat([['', '']]).forEach(([k, f], i) => {
          const row = el('div', 'fpe-row');
          const ks = select([['', i < pairs.length ? '—' : '+ its value…']].concat(vals.map(n => [n, humanize(n)])), k);
          const fs = select([['', 'is this form\'s field…']].concat(fieldsHere.map(y => [y.name, `is ${y.label || y.name}`])), f);
          const upd = () => { const next = pairs.slice(); next[i] = [ks.value, fs.value]; put(next); if (ks.value && fs.value) hard(); };
          ks.onchange = upd; fs.onchange = upd;
          row.append(ks, fs);
          ox.appendChild(row);
        });
      }
      const opensOff = FP.kinds && FP.structures.has(st) && FP.structures.get(st).kind && !FP.kinds.opensAndCloses(st) && FP.structures.get(st).kind !== 'list'
        ? `Not here: ${(FP.structures.get(st).label || st)} never open or close (its kind says so).` : null;
      opt('open', 'The open one', 'The open item (by its kind: the run still running, the order not done) whose line, say, is this form\'s line. Saving adds to it; if none is open, saving waits until one is started.', ox, opensOff);
      opt('where', 'Found by a rule', 'The latest item that matches, like the run that is running on this line. Saving adds to it; if none matches, saving waits until one is started.', wx);
      // Every one, or every one where…
      const lx = el('div', 'ffm-optx');
      if (cur === 'all') {
        containersOf(st);
        const fh = el('div', 'fpe-hint', 'Only the ones where (optional; names are the item\'s values, form.name is this form\'s):');
        const count = el('div', 'fpe-hint');
        let ct = null;
        const recount = () => {
          clearTimeout(ct);
          ct = setTimeout(async () => {
            const v = await FP.sources.evaluate({ sources: [x] }, {}, {}).catch(e => ({ [x.name]: { __fp: 'error', message: e.message } }));
            const got = v[x.name];
            count.textContent = Array.isArray(got) ? `${got.length} item${got.length === 1 ? '' : 's'} now${/form\./.test(x.filter || '') ? ' (with this form\'s fields blank)' : ''}` : FP.fn.describe(got).text;
          }, 300);
        };
        // Only the open ones (0.60): by the structure's kind.
        const oc = el('label', 'ffe-check'); const oi = input('', { type: 'checkbox' }); oi.checked = !!x.open;
        oi.onchange = () => { if (oi.checked) x.open = true; else delete x.open; changed(); soft(); recount(); };
        oc.append(oi, document.createTextNode(' Only the open ones (by its kind: runs still running, orders not done, a list\'s items in use)'));
        lx.append(oc, fh, formulaInput(x.filter || '', v => { if (v) x.filter = v; else delete x.filter; changed(); soft(); recount(); }, 'e.g. AND(status <> "Shipped", line = form.line)', filterHelp(st)), count);
        recount();
        // One tap: a table with a column for each value on the map (every value, if none is picked yet).
        const has = draft.fields.find(f => f.rowsFrom === x.name);
        lx.appendChild(btn(has ? 'Add the values on the map to its table' : 'Show these as a table', 'small', () => {
          let names = Object.keys(x.values || {});
          if (!names.length) { names = containersOf(st).map(([n]) => n); names.forEach(n => setUse(x, n, true, false)); }
          names.forEach(n => tableColumn(x, n, writes(useOf(x, n)) && !FP.sources.BUILT_IN.includes(st)));
          const t = draft.fields.find(f => f.rowsFrom === x.name);
          state.open = t ? 'f:' + t.name : state.open;
          changed(); hard();
        }));
      }
      opt('all', 'Every one (a list)', 'All the items, or all where…: for a table, counts and totals. Each value is then a list: racks.qty is every rack\'s qty.', lx);
    }

    /* Settings of one value of a source: read, write, and the fields that fill or show it. */
    function valueProps(x, c, box) {
      const u = useOf(x, c);
      const st = x.structure;
      const builtIn = FP.sources.BUILT_IN.includes(st);
      const worked = containersOf(st).some(([n, k]) => n === c && k !== 'container');
      const row = el('div', 'fpe-row');
      const rc = el('label', 'ffe-check'); const ri = input('', { type: 'checkbox' }); ri.checked = reads(u); rc.append(ri, document.createTextNode('This form reads it'));
      const wc = el('label', 'ffe-check'); const wi = input('', { type: 'checkbox' }); wi.checked = writes(u); wc.append(wi, document.createTextNode(isList(x) ? 'People change it, item by item' : 'This form saves to it'));
      wi.disabled = builtIn || worked;
      ri.onchange = wi.onchange = () => { setUse(x, c, ri.checked, wi.checked); if (!wi.checked) unfill(x, c); changed(); hard(); };
      row.append(rc, wc); box.appendChild(row);
      if (worked) box.appendChild(el('div', 'fpe-hint', `${st} works ${c} out itself, so forms only read it.`));
      if (builtIn) box.appendChild(el('div', 'fpe-hint', `${st} is built in: forms read it, and only its own screens change it.`));
      if (writes(u)) {
        const fl = fillersOf(x, c);
        const g = el('div', 'ffe-set'); g.appendChild(el('span', null, isList(x) ? 'Changed in' : 'Filled by'));
        if (fl.length) g.appendChild(el('div', 'fpe-hint', fl.map(f => f.label || f.name).join(' · ')));
        const free = draft.fields.filter(f => isEntry(f) && !f.writes && !f.rowsFrom && !(x.id && x.id.field === f.name));
        if (!isList(x)) {
          const s = select([['', fl.length ? 'add another field…' : 'pick a field…']].concat(free.map(f => [f.name, f.label || f.name])), '');
          s.onchange = () => { const f = byName(s.value); if (f) { f.writes = `${x.name}.${c}`; changed(); hard(); } };
          if (free.length) g.appendChild(s);
        } else if (free.length) {
          // One field on the form whose value every item of the list gets when saved: mark every rack on the cart shipped.
          const s = select([['', 'or the same value to every item, from a field…']].concat(free.map(f => [f.name, f.label || f.name])), '');
          s.onchange = () => { const f = byName(s.value); if (f) { f.writes = `${x.name}.${c}`; changed(); hard(); } };
          g.appendChild(s);
          g.appendChild(el('div', 'fpe-hint', `A field saving here gives every item of ${x.name} (as the list is when saved) the same ${c}.`));
        }
        if (!fl.length) g.appendChild(btn(isList(x) ? '+ Add it to the table' : '+ Make a field for this', 'small', () => { makeFiller(x, c); changed(); hard(); }));
        if (!fl.length) g.appendChild(el('div', 'fpe-warn', 'Nothing fills it yet.'));
        box.appendChild(g);
      }
      if (reads(u)) {
        const rd = readersOf(x, c);
        const g = el('div', 'ffe-set'); g.appendChild(el('span', null, 'Shown in'));
        g.appendChild(el('div', 'fpe-hint', rd.length ? rd.map(f => f.label || f.name).join(' · ') : `Nothing shows it yet. Formulas read it as ${x.name}.${c}${isList(x) ? ` (every item's ${c}, as a list)` : ''}.`));
        if (!rd.length) g.appendChild(btn(isList(x) ? '+ Show it in the table' : '+ Show it in a field', 'small', () => { makeReader(x, c); changed(); hard(); }));
        box.appendChild(g);
      }
    }

    /* ---------- The form's media list ---------- */
    const attach = (path, title) => {
      draft.media = Array.isArray(draft.media) ? draft.media : [];
      if (draft.media.some(m => m.path.toLowerCase() === path.toLowerCase())) { FP.editor.ui.toast(`${FP.media.titleOf(path)} is already on the list.`, true); return false; }
      draft.media.push(title && title !== FP.media.titleOf(path) ? { path, title } : { path });
      return true;
    };
    function mediaProps(m, i, p) {
      const set = (label, help, node) => { const w = el('div', 'ffe-set'); const h = el('span', null, label + ' '); if (help) h.appendChild(el('em', null, '· ' + help)); w.append(h, node); return w; };
      const st = el('div', 'fpe-hint', 'Checking the file…');
      FP.media.stat(m.path).then(x => { st.textContent = x ? `In the media folder · ${Math.max(1, Math.round(x.size / 1024))} KB · changed ${new Date(x.lastModified).toLocaleString()}` : `Can't find media/${m.path}: moved, renamed or not synced here yet.`; st.className = x ? 'fpe-hint' : 'fpe-warn'; }).catch(() => {});
      p.appendChild(st);
      const ti = input(m.title || '', { placeholder: FP.media.titleOf(m.path) });
      ti.oninput = () => { const t = ti.value.trim(); if (t && t !== FP.media.titleOf(m.path)) m.title = t; else delete m.title; changed(); soft(); };
      p.appendChild(set('Title', 'what people see', ti));
      const tg = input(FP.media.tagsText(m.tags), { placeholder: 'e.g. die: D-1047; kind: setup sheet' });
      const err = el('div', 'err');
      tg.oninput = () => { try { m.tags = FP.media.parseTags(tg.value); if (!Object.keys(m.tags).length) delete m.tags; err.textContent = ''; changed(); soft(); } catch (e) { err.textContent = e.message; } };
      p.appendChild(set('Tags', 'name: value; several values with commas; "all" matches any value', tg));
      p.appendChild(err);
      const r = el('div', 'fpe-row');
      r.append(btn('Open', 'small', () => FP.media.view(m.path).catch(e => FP.editor.ui.toast(e.message, true))),
        btn('Take it off the list', 'small', () => { draft.media.splice(i, 1); state.open = null; changed(); hard(); }));
      p.appendChild(r);
      p.appendChild(el('p', 'ffe-note', 'Taking it off the list leaves the file in the media folder. A new version of the file (same name) counts as changed: Read first asks again.'));
    }
    /* ---- The media library (0.61) ---- */
    const libOpen = () => { if (FP.editor.openPlace) FP.editor.openPlace('media-library', null); };
    function libEntryProps(m, i, p) {
      const e = FP.media.library.get(m.entry);
      if (e) {
        p.appendChild(el('div', 'fpe-hint', `${FP.media.tagsText(e.tags) || 'no tags'} · version ${e.revision} · ${e.folder || 'library'}`));
        const r = el('div', 'fpe-row');
        r.append(btn('Open', 'small', () => FP.media.view(e.path).catch(x => FP.editor.ui.toast(x.message, true))), btn('In the library ›', 'small', libOpen));
        p.appendChild(r);
      } else p.appendChild(el('div', 'fpe-warn', `${m.entry} isn't in the library any more.`));
      p.appendChild(btn('Take it off the list', 'small', () => { draft.media.splice(i, 1); state.open = null; changed(); hard(); }));
      p.appendChild(el('p', 'ffe-note', 'Its name, tags and versions are kept in the library, once for every form: change them there. A new version shows here at once, and Read first asks again.'));
    }
    function libRuleProps(m, i, p) {
      const tg = input(FP.media.tagsText(m.library), { placeholder: 'e.g. kind: setup sheet' });
      const err = el('div', 'err');
      const count = el('div', 'fpe-hint');
      const recount = () => { const l = FP.media.library.cached().filter(e => e.active && FP.media.matches(e.tags, m.library)); count.textContent = `${l.length} now: ${l.slice(0, 6).map(e => e.name).join(', ')}${l.length > 6 ? '…' : ''}`; };
      tg.oninput = () => { try { m.library = FP.media.parseTags(tg.value); err.textContent = ''; recount(); changed(); soft(); } catch (e) { err.textContent = e.message; } };
      const dl = el('datalist'); dl.id = 'ffe-libtags'; FP.media.library.tags().forEach(t => { const o = el('option'); o.value = `${t.name}: `; dl.appendChild(o); }); tg.setAttribute('list', dl.id);
      const set = (label, help, node) => { const w = el('div', 'ffe-set'); const h = el('span', null, label + ' '); if (help) h.appendChild(el('em', null, '· ' + help)); w.append(h, node); return w; };
      p.append(set('Tagged', 'name: value; several with commas; empty: every entry', tg), dl, err, count);
      recount();
      p.appendChild(btn('Take it off the list', 'small', () => { draft.media.splice(i, 1); state.open = null; changed(); hard(); }));
    }
    /* Pick entries of the library: search, Add each; New files go in through the library. */
    function libPicker(p) {
      const L = FP.media.library;
      const q = input('', { placeholder: 'Find by name or tag', type: 'search' });
      const list = el('div', 'ffe-group');
      p.append(q, list);
      const paint = () => {
        list.replaceChildren();
        const words = q.value.trim().toLowerCase();
        const on = new Set((draft.media || []).filter(m => m && m.entry).map(m => m.entry));
        const shown = L.cached().filter(e => e.active && (!words || `${e.name} ${FP.media.tagsText(e.tags)}`.toLowerCase().includes(words))).slice(0, 60);
        shown.forEach(e => {
          const line = el('div', 'fpe-row');
          line.append(el('span', null, e.name), el('span', 'fpe-hint', FP.media.tagsText(e.tags) || 'no tags'));
          if (on.has(e.id)) line.appendChild(el('span', 'fpe-hint', '✓ on the list'));
          else line.appendChild(btn('Add', 'small', () => { draft.media.push({ entry: e.id }); state.open = 'md:' + e.id; changed(); hard(); }));
          list.appendChild(line);
        });
        if (!shown.length) list.appendChild(el('div', 'fpe-hint', L.cached().length ? 'Nothing matches.' : 'The media library is empty.'));
      };
      q.oninput = paint;
      if (!L.loaded()) L.load().then(paint).catch(() => {}); else paint();
      p.appendChild(btn('Open the media library to bring new files in ›', 'small', libOpen));
    }
    /* Browse media/ and attach files: folders to open, files with Attach. */
    function mediaBrowser(p) {
      let parts = [];
      const box = el('div', 'ffe-group');
      p.appendChild(box);
      async function paint() {
        box.replaceChildren(el('div', 'fpe-hint', 'Loading…'));
        let r;
        try { r = await FP.media.browse(parts); } catch (e) { box.replaceChildren(el('div', 'fpe-warn', e.message)); return; }
        box.replaceChildren();
        const crumbs = el('div', 'fpe-row');
        crumbs.appendChild(btn('media', 'small', () => { parts = []; paint(); }));
        parts.forEach((x, k) => { crumbs.append(el('span', 'fpe-hint', '›'), btn(x, 'small', () => { parts = parts.slice(0, k + 1); paint(); })); });
        box.appendChild(crumbs);
        r.folders.forEach(d => { const b = btn(`📁 ${d}`, 'small', () => { parts = parts.concat(d); paint(); }); b.classList.add('ffe-folder'); box.appendChild(b); });
        const onList = new Set((draft.media || []).map(m => m.path.toLowerCase()));
        r.files.forEach(f => {
          const line = el('div', 'fpe-row');
          line.append(el('span', null, f.name), el('span', 'fpe-hint', f.size != null ? `${Math.max(1, Math.round(f.size / 1024))} KB` : ''));
          if (onList.has(f.path.toLowerCase())) line.appendChild(el('span', 'fpe-hint', '✓ on the list'));
          else line.appendChild(btn('Attach', 'small', () => { if (attach(f.path)) { state.open = 'md:' + f.path; changed(); hard(); } }));
          box.appendChild(line);
        });
        if (!r.folders.length && !r.files.length) box.appendChild(el('div', 'fpe-hint', parts.length ? 'Nothing in this folder.' : 'The media folder is empty. Copy files into Forms b\\media\\ with File Explorer (or a OneDrive shortcut to a SharePoint library), or add one below.'));
      }
      paint();
    }
    /* A file from this computer, copied into a folder of media/, then attached. */
    function mediaUpload(p) {
      const set = (label, help, node) => { const w = el('div', 'ffe-set'); const h = el('span', null, label + ' '); if (help) h.appendChild(el('em', null, '· ' + help)); w.append(h, node); return w; };
      const fi = input('', { type: 'file' });
      const fo = input(ctx.id, { placeholder: 'e.g. setup-sheets/Press 2' });
      const dl = el('datalist'); dl.id = 'ffe-media-folders'; fo.setAttribute('list', dl.id);
      FP.media.browse([]).then(r => r.folders.forEach(d => { const o = el('option'); o.value = d; dl.appendChild(o); })).catch(() => {});
      p.append(set('File', `up to ${Math.round(FP.media.maxBytes / 1048576)} MB`, fi), set('Into the folder', 'inside media; made if it isn\'t there', fo), dl);
      p.appendChild(btn('Add it and attach it', 'small', async () => {
        try {
          const f = fi.files && fi.files[0];
          if (!f) throw new Error('Choose a file.');
          const path = await FP.media.add(f, fo.value.trim());
          attach(path);
          FP.editor.ui.toast(`media/${path} is added.`);
          state.open = 'md:' + path; changed(); hard();
        } catch (e) { FP.editor.ui.toast(e.message, true); }
      }));
    }

    /* Settings of one field. */
    function fieldProps(f, box) {
      const d = FP.forms.describe(f.control);
      const lab = el('label', 'ffe-set'); lab.appendChild(el('span', null, 'Label'));
      const li = input(f.label || ''); lab.appendChild(li); box.appendChild(lab);
      const nm = el('label', 'ffe-set'); const nmHead = el('span', null, 'Name '); nmHead.appendChild(el('em', null, '· used in formulas; letters, digits and _'));
      nm.appendChild(nmHead);
      const ni = input(f.name, { spellcheck: false }); const nErr = el('div', 'err'); nm.append(ni, nErr); box.appendChild(nm);
      const rename = to => {
        if (to === f.name) return true;
        if (!NAME_RE.test(to)) { nErr.textContent = 'Letters, digits and _, starting with a letter.'; return false; }
        if (takenNames().has(to)) { nErr.textContent = 'A field, button or source has that name.'; return false; }
        renameField(draft, f.name, to); renamedRow('f:' + f.name, 'f:' + to); f.name = to; state.open = 'f:' + to; nErr.textContent = ''; return true;
      };
      // The name follows the label while it was made from the label; a field made from a value keeps the value's name.
      const tied = () => !!(f.writes || f.snapshot || /^\w+\.\w+$/.test(String(f.formula || '').trim()));
      li.oninput = () => { const auto = !tied() && nameFrom(f.label || '', new Set(fieldNames().filter(n => n !== f.name))) === f.name; f.label = li.value; if (auto && li.value.trim()) { const to = nameFrom(li.value, new Set(Array.from(takenNames()).filter(n => n !== f.name))); if (rename(to)) ni.value = to; } changed(); soft(); };
      ni.onchange = () => { if (rename(ni.value.trim())) { changed(); soft(); } else ni.value = f.name; };
      const cl = el('label', 'ffe-set'); cl.appendChild(el('span', null, 'Kind of field'));
      const all = FP.forms.controls();
      const cs = select(all.map(c => [c.name, `${c.label} (${c.category})`]), f.control);
      cs.onchange = () => {
        const keep = new Set(((FP.forms.controls().find(c => c.name === cs.value) || {}).settings || []).map(x => x.name));
        Object.keys(f).forEach(k => { if (!keep.has(k) && !['name', 'control', 'label'].includes(k)) delete f[k]; });
        f.control = cs.value; changed(); hard();
      };
      cl.appendChild(cs); box.appendChild(cl);
      if (d && d.help) box.appendChild(el('p', 'ffe-note', d.help));
      if (f.rowsFrom) box.appendChild(el('p', 'ffe-note', `One row per item of ${f.rowsFrom}. Its columns are the values ticked on ${f.rowsFrom} in Sources; tick "people change it" there to make a column editable.`));
      const settings = ((all.find(c => c.name === f.control) || {}).settings || []).filter(x => !['name', 'control', 'label'].includes(x.name) && !(f.rowsFrom && ['rows', 'addRows', 'startRows', 'maxRows', 'style', 'addLabel', 'itemLabel', 'allRows', 'rowsFrom'].includes(x.name)));
      const order = ['formula', 'writes', 'snapshot', 'required', 'when'];
      settings.sort((a, b) => (order.includes(a.name) ? order.indexOf(a.name) : 99) - (order.includes(b.name) ? order.indexOf(b.name) : 99));
      settings.forEach(x => box.appendChild(settingInput(x, f, () => { changed(); soft(); }, { field: f })));
      const acts = el('div', 'fpe-row');
      acts.append(btn('Duplicate', 'small', () => {
        const c = clone(f); c.name = nameFrom(f.name + ' copy', takenNames()); c.label = (f.label || f.name) + ' (copy)';
        draft.fields.splice(draft.fields.indexOf(f) + 1, 0, c);
        if (Array.isArray(draft.layout)) draft.layout.push([c.name]);
        state.open = 'f:' + c.name; changed(); hard();
      }), btn('Delete field', 'small', () => {
        if (!confirm(`Delete ${f.label || f.name}? Formulas that use it will show a problem.`)) return;
        draft.fields.splice(draft.fields.indexOf(f), 1);
        unplace(draft.layout, f.name);
        draft.sources.forEach(x => { if (x.id && x.id.field === f.name) x.id = {}; });
        state.open = null; changed(); hard();
      }));
      box.appendChild(acts);
    }

    /* Settings of one button. */
    function buttonProps(b, box) {
      const lab = el('label', 'ffe-set'); lab.appendChild(el('span', null, 'Label'));
      const li = input(b.label || ''); li.oninput = () => { b.label = li.value; changed(); soft(); }; lab.appendChild(li); box.appendChild(lab);
      const nm = el('label', 'ffe-set'); nm.appendChild(el('span', null, 'Name'));
      const ni = input(b.name, { spellcheck: false }); const ne = el('div', 'err');
      ni.onchange = () => {
        const to = ni.value.trim();
        if (to === b.name) return;
        if (!NAME_RE.test(to) || takenNames().has(to)) { ne.textContent = 'Letters, digits and _, not used by a field, source or other button.'; ni.value = b.name; return; }
        b.name = to; state.open = 'b:' + to; changed(); hard();
      };
      nm.append(ni, ne); box.appendChild(nm);
      const al = el('label', 'ffe-set'); al.appendChild(el('span', null, 'What it does'));
      const acts = [['save', 'Save'], ['subform', 'Open a sub-form'], ['set', 'Fill in fields (e.g. All pass)']];
      if (b.action === 'apply') acts.push(['apply', 'Apply (an older setting: hand values back to the form that opened this one)']);
      if (b.action === 'open') acts.push(['open', 'Open another published form (an older setting: sub-forms do this now)']);
      const as = select(acts, b.action);
      as.onchange = () => {
        b.action = as.value; ['scope', 'form', 'link', 'prefill', 'apply', 'saveAs', 'subform', 'sets', 'then'].forEach(k => delete b[k]);
        if (b.action === 'set') b.sets = {};
        if (b.action === 'subform' && (draft.subforms || []).length) b.subform = draft.subforms[0].name;
        changed(); hard();
      };
      al.appendChild(as); box.appendChild(al);
      if (b.action === 'subform') {
        const sl2 = el('label', 'ffe-set'); sl2.appendChild(el('span', null, 'Sub-form it opens'));
        const list = (draft.subforms || []).filter(Boolean);
        const ss2 = select([['', list.length ? 'choose a sub-form…' : 'no sub-forms yet']].concat(list.map(x => [x.name, x.label || x.name])), b.subform || '');
        ss2.onchange = () => { if (ss2.value) b.subform = ss2.value; else delete b.subform; changed(); hard(); };
        sl2.appendChild(ss2); box.appendChild(sl2);
        const sf = list.find(x => x.name === b.subform);
        if (sf) box.appendChild(btn(`Edit ${sf.label || sf.name} ›`, 'small', () => editSubform(sf)));
        else box.appendChild(btn('+ New sub-form', 'small', () => {
          draft.subforms = Array.isArray(draft.subforms) ? draft.subforms : [];
          const name = nameFrom('subform', new Set(Array.from(takenNames()).concat(draft.subforms.map(x => x.name))));
          draft.subforms.push({ name, label: b.label || 'Sub-form', fields: [], sources: [] });
          b.subform = name; state.open = 'sf:' + name; changed(); hard();
        }));
      }
      // Set (0.46): fills fields with fixed values; nothing is saved until a save button is pressed.
      if (b.action === 'set') {
        b.sets = b.sets && typeof b.sets === 'object' && !Array.isArray(b.sets) ? b.sets : {};
        const sl3 = el('div', 'ffe-set'); sl3.appendChild(el('span', null, 'What it fills in'));
        const entries = draft.fields.filter(isEntry);
        Object.keys(b.sets).forEach(n => {
          const row = el('div', 'ffe-setrow');
          const f = entries.find(x => x.name === n);
          row.appendChild(el('span', null, f ? (f.label || f.name) : `${n} (not a field)`));
          const opts = f && Array.isArray(f.options) ? f.options.map(o => typeof o === 'object' && o ? String(o.value != null ? o.value : o.label) : String(o)) : null;
          const cur = b.sets[n] == null ? '' : String(b.sets[n]);
          const vi = opts && opts.length ? select(opts.map(o => [o, o]).concat(opts.includes(cur) || !cur ? [] : [[cur, cur]]), cur) : input(cur, { placeholder: 'value' });
          const put = () => { const v = vi.value; b.sets[n] = f && /number|stepper|slider/.test(f.control) && v !== '' && !isNaN(+v) ? +v : f && f.control === 'checkbox' ? v === 'true' : v; changed(); soft(); };
          vi.onchange = put; if (vi.tagName === 'INPUT') vi.oninput = put;
          row.appendChild(vi);
          row.appendChild(btn('✕', 'small', () => { delete b.sets[n]; changed(); hard(); }));
          sl3.appendChild(row);
        });
        const free = entries.filter(f => !(f.name in b.sets));
        if (free.length) {
          const add = select([['', '+ Add a field…']].concat(free.map(f => [f.name, f.label || f.name])), '');
          add.onchange = () => {
            const f = free.find(x => x.name === add.value); if (!f) return;
            const o = Array.isArray(f.options) && f.options.length ? f.options[0] : '';
            b.sets[f.name] = typeof o === 'object' && o ? (o.value != null ? o.value : o.label) : o;
            changed(); hard();
          };
          sl3.appendChild(add);
        }
        sl3.appendChild(el('div', 'fpe-hint', 'Fills these fields when pressed, if they show. People can still change them before saving.'));
        box.appendChild(sl3);
      }
      if (b.action === 'save') {
        const sl = el('label', 'ffe-set'); sl.appendChild(el('span', null, 'What it saves'));
        const labels = layoutLabels(draft.layout);
        const curScope = b.scope == null ? 'form' : Array.isArray(b.scope) ? '__fields' : typeof b.scope === 'object' ? ['section', 'tab', 'step'].map(k => b.scope[k] != null ? `${k}:${b.scope[k]}` : null).filter(Boolean)[0] : b.scope;
        const opts = [['form', 'the whole form'], ['tree', 'the form and the records it opened (linked ones waiting with it)'], ['__fields', 'some fields…']].concat(labels.map(([k, l]) => [`${k}:${l}`, `the ${k} ${l}`]));
        const ss = select(opts, curScope);
        ss.onchange = () => {
          if (ss.value === 'form') delete b.scope; else if (ss.value === 'tree') b.scope = 'tree'; else if (ss.value === '__fields') b.scope = [];
          else { const [k, ...l] = ss.value.split(':'); b.scope = {}; b.scope[k] = l.join(':'); }
          changed(); hard();
        };
        sl.appendChild(ss); box.appendChild(sl);
        if (Array.isArray(b.scope)) box.appendChild(chips(draft.fields.map(f => [f.label || f.name, b.scope.includes(f.name) ? 'container on' : 'container', f.name]), n => { b.scope = b.scope.includes(n) ? b.scope.filter(x => x !== n) : b.scope.concat(n); changed(); hard(); }));
        // Optional: a name for what this button's saves do, kept on each entry (racks.ship).
        const nl = el('div', 'ffe-set'); const nh = el('span', null, 'Name this save '); nh.appendChild(el('em', null, '· optional; kept on every entry it makes, so structures and reports can tell saves apart'));
        nl.appendChild(nh);
        const sts = draft.sources.filter(x => x.kind !== 'value' && x.structure && Object.values(x.values || {}).some(writes)).map(x => x.structure);
        const ai = input(b.saveAs || '', { placeholder: draft.action || 'save', spellcheck: false });
        const aerr = el('div', 'err');
        const setAs = v => {
          if (v && !/^[a-z][a-zA-Z0-9]{0,39}$/.test(v)) { aerr.textContent = 'One word, starting with a small letter: ship, create, inspect.'; return; }
          aerr.textContent = ''; if (v) b.saveAs = v; else delete b.saveAs; changed(); soft();
        };
        ai.oninput = () => setAs(ai.value.trim());
        nl.appendChild(ai);
        const used = savedNamesFor(sts).filter(a => a !== 'save');
        if (used.length) nl.appendChild(chips(used.map(a => [a, 'action' + (b.saveAs === a ? ' on' : '')]), a => { ai.value = a; setAs(a); hard(); }));
        nl.appendChild(el('div', 'fpe-hint', sts.length ? (used.length ? `Names other forms give their saves to ${sts.join(', ')}. Tap one to use it, or type a new one.` : `No form names its saves to ${sts.join(', ')} yet.`) : 'This form saves to no structure yet.'));
        nl.appendChild(aerr);
        box.appendChild(nl);
        // After saving (0.44): the next record, the home screen, or the saved record left on screen.
        if (!subOf) {
          const tl = el('label', 'ffe-set'); tl.appendChild(el('span', null, 'After saving'));
          const ts = select([['next', 'Start the next one (clear the form)'], ['close', 'Close the form (back to the home screen)'], ['stay', 'Stay on screen (the next change starts a new record)']], b.then || 'next');
          ts.onchange = () => { if (ts.value === 'next') delete b.then; else b.then = ts.value; changed(); hard(); };
          tl.appendChild(ts);
          tl.appendChild(el('div', 'fpe-hint', b.then === 'close' ? 'On a shortcut to this one form there is no home screen: it starts the next one instead.' : b.scope && b.scope !== 'form' && b.scope !== 'tree' ? 'Only when it saves the whole form; saving a part always stays on screen.' : 'A form opened from another always goes back to it.'));
          box.appendChild(tl);
        }
      }
      if (b.action === 'open') {
        const fl = el('label', 'ffe-set'); fl.appendChild(el('span', null, 'Form it opens'));
        const forms = FP.defs.list('form').filter(d => !d.retired && d.id !== ctx.id);
        const fs = select([['', 'choose a form…']].concat(forms.map(d => [d.id, `${(d.def && d.def.title) || d.id} (${d.id})`])), b.form || '');
        fs.onchange = () => { if (fs.value) b.form = fs.value; else delete b.form; delete b.prefill; delete b.apply; changed(); hard(); };
        fl.appendChild(fs); box.appendChild(fl);
        const child = b.form ? FP.defs.get('form', b.form) : null;
        if (child && ctx.open) box.appendChild(btn(`Edit ${(child.def && child.def.title) || b.form} ›`, 'small', () => ctx.open('form', b.form)));
        const kl = el('label', 'ffe-set'); const kh = el('span', null, 'Linked to '); kh.appendChild(el('em', null, "· its records point at this form's item, and are saved with it"));
        kl.appendChild(kh);
        const ks = select([['', 'not linked']].concat(itemSources().filter(x => itemSaved(x)).map(x => [x.name, `this form's ${x.name} item (${x.structure})`])), b.link || '');
        ks.onchange = () => { if (ks.value) b.link = ks.value; else delete b.link; changed(); soft(); };
        kl.appendChild(ks); box.appendChild(kl);
        if (child) {
          const cf = (child.def.fields || []).filter(f => f && f.name);
          const centry = cf.filter(f => FP.forms.describe(f.control) && FP.forms.describe(f.control).category === 'entry');
          const pf = el('div', 'ffe-set'); pf.appendChild(el('span', null, 'Prefilled going down (its field ← a formula here)'));
          const pg = el('div', 'ffe-group');
          b.prefill = b.prefill || {};
          Object.entries(b.prefill).forEach(([k, fx]) => {
            const r = el('div', 'ffe-maprow');
            const ks2 = select(centry.map(f => [f.name, f.label || f.name]).concat(centry.some(f => f.name === k) ? [] : [[k, k]]), k);
            const fbox = formulaInput(fx, v => { b.prefill[ks2.value] = v; changed(); }, 'e.g. profile', formulaHelp());
            ks2.onchange = () => { const v = b.prefill[k]; delete b.prefill[k]; b.prefill[ks2.value] = v; changed(); hard(); };
            r.append(ks2, fbox, btn('✕', 'small', () => { delete b.prefill[k]; changed(); hard(); }));
            pg.appendChild(r);
          });
          const freeP = centry.filter(f => !(f.name in b.prefill));
          if (freeP.length) pg.appendChild(btn('+ Prefill a field', 'small', () => { const f = freeP[0]; b.prefill[f.name] = byName(f.name) ? f.name : ''; changed(); hard(); }));
          pf.appendChild(pg); box.appendChild(pf);
          const af = el('div', 'ffe-set'); af.appendChild(el('span', null, 'Handed back coming up (a field here ← its field)'));
          const ag = el('div', 'ffe-group');
          b.apply = b.apply || {};
          const mine = draft.fields.filter(isEntry);
          Object.entries(b.apply).forEach(([k, theirs]) => {
            const r = el('div', 'ffe-maprow');
            const ms = select(mine.map(f => [f.name, f.label || f.name]), k);
            const ts = select(cf.map(f => [f.name, f.label || f.name]), theirs);
            ms.onchange = () => { delete b.apply[k]; b.apply[ms.value] = ts.value; changed(); hard(); };
            ts.onchange = () => { b.apply[ms.value] = ts.value; changed(); };
            r.append(ms, el('span', 'fpe-hint', '←'), ts, btn('✕', 'small', () => { delete b.apply[k]; changed(); hard(); }));
            ag.appendChild(r);
          });
          const freeA = mine.filter(f => !(f.name in b.apply));
          if (freeA.length && cf.length) ag.appendChild(btn('+ Hand a value back', 'small', () => { b.apply[freeA[0].name] = (cf.find(f => f.name === freeA[0].name) || cf[0]).name; changed(); hard(); }));
          af.appendChild(ag); box.appendChild(af);
        }
      }
      const wl = el('label', 'ffe-set'); wl.appendChild(el('span', null, 'Shown only when'));
      wl.appendChild(formulaInput(b.when || '', v => { if (v) b.when = v; else delete b.when; changed(); soft(); }, 'e.g. result = "Fail" (optional)', formulaHelp()));
      box.appendChild(wl);
      box.appendChild(btn('Delete button', 'small', () => {
        draft.buttons.splice(draft.buttons.indexOf(b), 1);
        if (!draft.buttons.length) delete draft.buttons;
        state.open = null; changed(); hard();
      }));
    }

    /* Settings of the form itself. */
    /* ---------- Sub-forms (0.40): their settings on the master's map, and editing one in place ---------- */
    const subSaves = sf => (sf.fields || []).some(f => f && (f.writes || f.snapshot || f.rowsFrom));
    // Switching between once and repeating: values sent back gain (or lose) what to do with several.
    const fixHows = sf => (sf.back || []).forEach(x => { if (FP.forms.repeatKind(sf) === 'once') delete x.how; else if (!x.how) x.how = 'last'; });
    function subformProps(sf, i, p) {
      const masterLabel = 'this form';
      p.appendChild(btn('Edit its fields and sources ›', 'small', () => editSubform(sf)));
      const ll = el('label', 'ffe-set'); ll.appendChild(el('span', null, 'Label'));
      const li = input(sf.label || '', { placeholder: sf.name });
      li.oninput = () => {
        const before = sf.label;
        sf.label = li.value;
        // A new sub-form's name and its button's label follow its label until something reads it by name.
        (draft.buttons || []).forEach(b => { if (b && b.action === 'subform' && b.subform === sf.name && (b.label === 'Open sub-form' || b.label === before || b.label === `Open ${before}`)) b.label = li.value || 'Open sub-form'; });
        if (/^subform\d*$/.test(sf.name) && li.value.trim()) {
          const to = nameFrom(li.value, new Set(Array.from(takenNames()).filter(n => n !== sf.name)));
          if (to && to !== sf.name && !new RegExp('\\b' + sf.name + '\\b').test(JSON.stringify([draft.fields, draft.sources, draft.layout, draft.subforms.map(x => x.back)]))) {
            (draft.buttons || []).forEach(b => { if (b && b.subform === sf.name) b.subform = to; });
            renamedRow('sf:' + sf.name, 'sf:' + to);
            sf.name = to; state.open = 'sf:' + to;
          }
        }
        changed(); soft();
      };
      ll.appendChild(li); p.appendChild(ll);
      const tl = el('div', 'ffe-set'); const th = el('span', null, 'Named by '); th.appendChild(el('em', null, '· optional: a formula over this form\'s fields, shown on its screen and its button'));
      tl.append(th, formulaInput(sf.title || '', v => { if (v) sf.title = v; else delete sf.title; changed(); soft(); }, 'e.g. "Re-test for " & dieNo', formulaHelp()));
      p.appendChild(tl);
      // Opened by
      const by = (draft.buttons || []).filter(b => b && b.action === 'subform' && b.subform === sf.name);
      const ol = el('div', 'ffe-set'); ol.appendChild(el('span', null, 'Opened by'));
      if (by.length) ol.appendChild(chips(by.map(b => [b.label || b.name, 'action', b.name]), n => { state.open = 'b:' + n; hard(); }));
      ol.appendChild(btn('+ A button that opens it', 'small', () => {
        if (!Array.isArray(draft.buttons)) draft.buttons = [{ name: 'save', label: draft.saveLabel || 'Save', action: 'save' }];
        draft.buttons.push({ name: nameFrom('open' + sf.name[0].toUpperCase() + sf.name.slice(1), takenNames()), label: sf.label || 'Open', action: 'subform', subform: sf.name });
        changed(); hard();
      }));
      p.appendChild(ol);
      // How many times
      const kind = FP.forms.repeatKind(sf);
      const cur = kind === 'count' ? (typeof sf.repeat.count === 'number' ? 'n' : 'fx') : kind;
      const hl = el('label', 'ffe-set'); hl.appendChild(el('span', null, 'How many times'));
      const hs = select([['once', 'Once'], ['n', 'A set number of times'], ['fx', 'A number a formula works out'], ['list', 'Once for each item of a list'], ['open', 'As many as needed (Save and add another)']], cur);
      hs.onchange = () => {
        const v = hs.value;
        if (v === 'once') delete sf.repeat; else if (v === 'n') sf.repeat = { count: 3 }; else if (v === 'fx') sf.repeat = { count: '' }; else if (v === 'list') sf.repeat = { list: '' }; else sf.repeat = { open: true };
        fixHows(sf); changed(); hard();
      };
      hl.appendChild(hs); p.appendChild(hl);
      if (cur === 'n') {
        const ni = input(String(sf.repeat.count), { type: 'number', min: 1 });
        ni.oninput = () => { const n = Math.floor(Number(ni.value)); if (n >= 1) { sf.repeat.count = n; changed(); soft(); } };
        p.appendChild(ni);
      }
      if (cur === 'fx') p.appendChild(formulaInput(sf.repeat.count || '', v => { sf.repeat.count = v; changed(); soft(); }, 'e.g. die.cavities', formulaHelp()));
      if (cur === 'list') {
        p.appendChild(formulaInput(sf.repeat.list || '', v => { sf.repeat.list = v; changed(); soft(); }, 'e.g. openRuns (a source of many items)', formulaHelp()));
        p.appendChild(el('div', 'fpe-hint', 'Inside it, each is the list item for the run it is on, and index its number (1, 2, …). The list is taken when it opens; one changed on another terminal meanwhile says so when its turn comes.'));
      }
      if (kind === 'open') p.appendChild(el('div', 'fpe-hint', 'Its button opens it again and again (Save and add another) until Finish. Inside it, index is the number of the run.'));
      // Saving
      if (subSaves(sf)) {
        const svl = el('label', 'ffe-set'); svl.appendChild(el('span', null, 'Its records are saved'));
        const sv = select([['with', `With ${masterLabel}: all or nothing, when ${masterLabel} is saved`], ['own', 'On their own, when its Save is tapped']], sf.saves === 'own' ? 'own' : 'with');
        sv.onchange = () => { if (sv.value === 'own') sf.saves = 'own'; else delete sf.saves; changed(); soft(); };
        svl.appendChild(sv); p.appendChild(svl);
        p.appendChild(el('div', 'fpe-hint', sf.saves === 'own' ? `Its records point at ${masterLabel}'s record, whose ID is set aside when the first one saves. Until ${masterLabel} is saved too, it says so at the bottom.` : `Until ${masterLabel} is saved they wait with it, listed above its buttons, where they can be opened again or removed.`));
        const saved = itemSources().filter(x => itemSaved(x));
        if (saved.length) {
          const kl = el('label', 'ffe-set'); const kh = el('span', null, 'Its records point at '); kh.appendChild(el('em', null, `· which of ${masterLabel}'s records`)); kl.appendChild(kh);
          const ks = select([['', `${masterLabel}'s ${saved[0].name} item (the first it saves)`]].concat(saved.slice(1).map(x => [x.name, `${masterLabel}'s ${x.name} item (${x.structure})`])), sf.link || '');
          ks.onchange = () => { if (ks.value) sf.link = ks.value; else delete sf.link; changed(); soft(); };
          kl.appendChild(ks); p.appendChild(kl);
        }
      }
      const rq = el('label', 'ffe-check'); const rb = input('', { type: 'checkbox' }); rb.checked = !!sf.required;
      rb.onchange = () => { if (rb.checked) sf.required = true; else delete sf.required; changed(); soft(); };
      rq.append(rb, document.createTextNode(kind === 'count' || kind === 'list' ? `Required: ${masterLabel} can't be saved until every run is done` : `Required: ${masterLabel} can't be saved until it is done`));
      p.appendChild(rq);
      // Sends back
      const bl = el('div', 'ffe-set'); const bh = el('span', null, 'Sends back '); bh.appendChild(el('em', null, `· a field here ← its field${kind === 'once' ? '' : ', and what to do with the several values'}`)); bl.appendChild(bh);
      const bg = el('div', 'ffe-group');
      sf.back = Array.isArray(sf.back) ? sf.back : [];
      const mine = draft.fields.filter(isEntry);
      const theirs = (sf.fields || []).filter(f => f && f.name);
      sf.back.forEach((x, k) => {
        const r = el('div', 'ffe-maprow sb');
        const ms = select(mine.map(f => [f.name, f.label || f.name]).concat(mine.some(f => f.name === x.to) ? [] : [[x.to, x.to || 'choose…']]), x.to);
        const ts = select(theirs.map(f => [f.name, f.label || f.name]).concat(theirs.some(f => f.name === x.from) ? [] : [[x.from, x.from || 'choose…']]), x.from);
        ms.onchange = () => { x.to = ms.value; changed(); hard(); };
        ts.onchange = () => { x.from = ts.value; changed(); hard(); };
        r.append(ms, el('span', 'fpe-hint', '←'), ts);
        r.appendChild(btn('✕', 'small', () => { sf.back.splice(k, 1); changed(); hard(); }));
        if (kind !== 'once') {
          const hw = select(FP.forms.HOWS.map(h => [h, FP.forms.HOW_LABEL[h]]), x.how || 'last');
          hw.onchange = () => { x.how = hw.value; changed(); hard(); };
          const hrow = el('div', 'how'); hrow.append(el('span', 'fpe-hint', 'of all its runs, send'), hw);
          r.appendChild(hrow);
        }
        bg.appendChild(r);
        const why = FP.forms.backFits(sf, theirs.find(f => f.name === x.from), draft.fields.find(f => f.name === x.to), kind === 'once' ? undefined : (x.how || 'last'));
        if (why) bg.appendChild(el('div', 'err', why));
      });
      if (mine.length && theirs.length) bg.appendChild(btn('+ Send a value back', 'small', () => {
        const to = mine.find(f => !sf.back.some(x => x.to === f.name)) || mine[0];
        const from = theirs.find(f => f.name === to.name) || theirs[0];
        sf.back.push(Object.assign({ to: to.name, from: from.name }, kind === 'once' ? {} : { how: 'last' }));
        changed(); hard();
      }));
      else bg.appendChild(el('div', 'fpe-hint', !theirs.length ? 'Give it fields first (Edit its fields and sources).' : `${masterLabel} has no field people fill in to send a value to.`));
      bl.appendChild(bg); p.appendChild(bl);
      p.appendChild(btn('Remove this sub-form', 'small', () => {
        if (!confirm(`Remove ${sf.label || sf.name} and the buttons that open it?`)) return;
        draft.subforms.splice(i, 1);
        if (!draft.subforms.length) delete draft.subforms;
        if (Array.isArray(draft.buttons)) draft.buttons = draft.buttons.filter(b => !(b && b.action === 'subform' && b.subform === sf.name));
        if (Array.isArray(draft.layout)) draft.layout = JSON.parse(JSON.stringify(draft.layout), (k, v) => v);
        state.open = null; changed(); hard();
      }));
    }
    function editSubform(sf) {
      const prefix = `Sub-form ${sf.name}: `;
      const mine = list => (list || []).filter(t => t.startsWith(prefix)).map(t => t.slice(prefix.length));
      sf.fields = Array.isArray(sf.fields) ? sf.fields : [];
      sf.sources = Array.isArray(sf.sources) ? sf.sources : [];
      const subCtx = {
        id: `${ctx.id}.${sf.name}`, changed: ctx.changed, open: ctx.open,
        formState: { tab: 'map', open: null, width: state.width, mode: state.mode },
        problems: mine(problems),
        subOf: {
          master: draft, masterId: ctx.id, sf,
          back: () => {
            state.open = 'sf:' + sf.name;
            ctx.problems = problems;
            if (subCtx.destroy) subCtx.destroy();
            subRoot.replaceWith(formEditor(draft, ctx));
          },
        },
      };
      const subRoot = formEditor(sf, subCtx);
      ctx.problemsChanged = list => { problems = list || []; ctx.problems = problems; if (subCtx.problemsChanged) subCtx.problemsChanged(mine(list)); };
      ctx.goToProblem = () => { if (subCtx.goToProblem) subCtx.goToProblem(); };
      if (inst) { inst.destroy(); inst = null; }
      root.replaceWith(subRoot);
    }

    function settingsProps(box) {
      const fs = FP.forms.formSettings();
      const get = n => fs.find(x => x.name === n);
      box.appendChild(settingInput(get('title'), draft, () => { changed(); soft(); }));
      // Where it is used: every site, or some.
      const sl = el('div', 'ffe-set'); sl.appendChild(el('span', null, 'Used at'));
      box.appendChild(sl);
      if (FP.editor.ui.sitesPicker) FP.editor.ui.sitesPicker(draft, () => { changed(); soft(); }).then(n => sl.appendChild(n)).catch(() => {});
      if (draft.action) {
        const al = el('div', 'ffe-set');
        const ah = el('span', null, 'Name of its saves '); ah.appendChild(el('em', null, '· an older setting, for save buttons that don\'t name their own'));
        al.appendChild(ah);
        const ai = input(draft.action, { spellcheck: false });
        const aerr = el('div', 'err');
        ai.oninput = () => {
          const v = ai.value.trim();
          if (v && !/^[a-z][a-zA-Z0-9]{0,39}$/.test(v)) { aerr.textContent = 'One word, starting with a small letter.'; return; }
          aerr.textContent = ''; if (v && v !== 'save') draft.action = v; else delete draft.action; changed();
        };
        al.append(ai, aerr, btn('Move it to the save buttons', 'small', () => {
          if (!Array.isArray(draft.buttons)) draft.buttons = [{ name: 'save', label: draft.saveLabel || 'Save', action: 'save' }];
          draft.buttons.forEach(b => { if (b && b.action === 'save' && !b.saveAs) b.saveAs = draft.action; });
          delete draft.action; changed(); hard();
        }));
        box.appendChild(al);
      }
      FP.forms.plainFormSettings().forEach(n => { const x = get(n); if (x && !(x.older && draft[n] == null)) box.appendChild(settingInput(x, draft, () => { changed(); soft(); })); });
      const pl = el('div', 'ffe-set'); pl.appendChild(el('span', null, 'Printing'));
      const pc = el('label', 'ffe-check'); const pi = input('', { type: 'checkbox' }); pi.checked = !!draft.print;
      pc.append(pi, document.createTextNode('Can be printed (a filled record, or blank for paper use)'));
      pl.appendChild(pc);
      const po = el('div', 'ffe-group');
      const PRINT = [{ name: 'page', type: 'choice', label: 'Paper', options: ['letter', 'a4'] }, { name: 'orientation', type: 'choice', label: 'Orientation', options: ['portrait', 'landscape'] },
        { name: 'margin', type: 'integer', label: 'Margin (mm)', min: 5 }, { name: 'signatures', type: 'texts', label: 'Signature lines', help: 'e.g. Checked by, Reviewed by' }, { name: 'blankRows', type: 'integer', label: 'Table rows on a blank form', min: 1 }];
      const paintPrint = () => {
        po.replaceChildren();
        if (!draft.print) return;
        const obj = draft.print === true ? {} : draft.print;
        PRINT.forEach(x => po.appendChild(settingInput(x, obj, () => { draft.print = Object.keys(obj).length ? obj : true; changed(); })));
      };
      pi.onchange = () => { if (pi.checked) draft.print = true; else delete draft.print; changed(); paintPrint(); soft(); };
      paintPrint();
      pl.appendChild(po);
      box.appendChild(pl);
      if (FP.due) box.appendChild(FP.centers ? dueMoved() : dueSettings());
    }

    /* Due (0.54): when this form is due, who is responsible, and who is told when it is missed. */
    /* 0.56: when a form is due is a duty of a responsibility center (People › Responsibility centers), so it can be
     * shared and owned. A form that still has its own schedules shows them, and moves them into a new center. */
    function dueMoved() {
      const wrap = el('div', 'ffe-set ffe-due');
      const h = el('span', null, 'Due '); h.appendChild(el('em', null, '· set in a responsibility center (People › Responsibility centers): its duties say which forms do them, and when'));
      wrap.appendChild(h);
      const own = Array.isArray(draft.due) ? draft.due : [];
      if (!own.length) return wrap;
      own.forEach(sc => wrap.appendChild(el('p', 'ffe-note', `${sc.name}: ${FP.due.describe(sc)}`)));
      wrap.appendChild(btn('Move these into a new responsibility center', 'small', async () => {
        try {
          const groups = await FP.groups.list().catch(() => []);
          const id = ctx.id;
          const runsAt = groups.filter(g => g.forms.includes(id));
          const byOwner = new Map();
          own.forEach(sc => {
            const o = sc.owner || { signedIn: true };
            const key = o.signedIn ? 'signedIn' : `${o.role || ''}|${o.department || ''}`;
            if (!byOwner.has(key)) byOwner.set(key, { o, duties: [] });
            const d = { name: sc.name, forms: [id] };
            ['label', 'every', 'at', 'days', 'window', 'grace', 'critical', 'per', 'while'].forEach(k => { if (sc[k] != null) d[k] = sc[k]; });
            const each = sc.forEach || sc.forEachOpen; if (each) d.forEach = each;
            byOwner.get(key).duties.push(d);
          });
          const title = (draft.title || id);
          for (const { o, duties } of byOwner.values()) {
            const members = o.signedIn ? { signedInAt: runsAt.map(g => ({ kind: 'group', id: g.id })) } : { role: o.role || null, departments: o.department ? [o.department] : [] };
            if (o.signedIn && !members.signedInAt.length) throw new Error('This form runs on no terminal group yet: put it on one first, or make the responsibility center by hand.');
            await FP.centers.create({ name: o.signedIn ? `${title}: whoever is signed in` : `${title}: ${[o.department, o.role].filter(Boolean).join(' ')}`, members, duties });
          }
          delete draft.due; changed(); soft();
          toast('Moved into a new responsibility center (People › Responsibility centers). Publish this form to take its own schedules off.');
          wrap.replaceChildren(h, el('p', 'ffe-note', 'Moved into a new responsibility center. Publish this form to take its own schedules off.'));
        } catch (e) { toast(e.message, true); }
      }));
      return wrap;
    }
    function dueSettings() {
      const wrap = el('div', 'ffe-set ffe-due');
      const h = el('span', null, 'Due '); h.appendChild(el('em', null, '· when this form must be done; the launcher shows it due, late and missed, and keeps every miss'));
      wrap.appendChild(h);
      const list = el('div');
      wrap.appendChild(list);
      // The library's structures (not the kernel's own), by name.
      const userStructures = () => FP.defs.list('structure').filter(d => !d.retired && d.def).map(d => Object.assign({ id: d.id }, d.def)).sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)));
      const csv = a => (a || []).join(', ');
      const fromCsv = t => String(t || '').split(',').map(x => x.trim()).filter(Boolean);
      const done = () => { if (!draft.due.length) delete draft.due; changed(); soft(); };
      const row = (label, help, node) => { const r = el('div', 'ffe-set'); const sp = el('span', null, label + ' '); if (help) sp.appendChild(el('em', null, '· ' + help)); r.append(sp, node); return r; };
      const whoTold = (obj, key, title) => {
        const w = obj[key] || {};
        const g = el('div', 'ffe-group');
        const ri = input(csv(w.roles), { placeholder: 'e.g. supervisor', spellcheck: false });
        const di = input(csv(w.departments), { placeholder: 'e.g. Quality', spellcheck: false });
        const set = () => { const x = { roles: fromCsv(ri.value), departments: fromCsv(di.value) }; if (w.people && w.people.length) x.people = w.people; Object.keys(x).forEach(k => { if (!x[k].length) delete x[k]; }); if (Object.keys(x).length) obj[key] = x; else delete obj[key]; };
        ri.onchange = () => { set(); done(); }; di.onchange = () => { set(); done(); };
        g.append(row(title + ': roles', 'user, supervisor, publisher, admin; each includes the roles above it', ri), row('and departments', 'as written on each person', di));
        return g;
      };
      const paint = () => {
        list.replaceChildren();
        (draft.due || []).forEach((sc, i) => {
          const card = el('div', 'ffe-group');
          card.appendChild(el('p', 'ffe-note', FP.due.describe(sc)));
          const ni = input(sc.name || '', { spellcheck: false, placeholder: 'e.g. hourly' });
          ni.onchange = () => { sc.name = ni.value.trim(); done(); paint(); };
          card.appendChild(row('Name', 'one word, e.g. hourly', ni));
          const how = select([['every', 'Every so many minutes'], ['at', 'At set times of day']], sc.at ? 'at' : 'every');
          how.onchange = () => { if (how.value === 'at') { delete sc.every; delete sc.forEach; delete sc.forEachOpen; delete sc.while; sc.at = sc.at || ['08:00']; } else { delete sc.at; delete sc.days; delete sc.window; sc.every = sc.every || 60; } done(); paint(); };
          card.appendChild(row('Repeats', null, how));
          if (sc.at) {
            const ti = input(csv(sc.at), { spellcheck: false, placeholder: '06:00, 14:00, 22:00' });
            ti.onchange = () => { sc.at = fromCsv(ti.value); done(); paint(); };
            const di = input(csv(sc.days), { spellcheck: false, placeholder: 'every day, or e.g. mon, tue, wed, thu, fri' });
            di.onchange = () => { const d = fromCsv(di.value.toLowerCase()); if (d.length) sc.days = d; else delete sc.days; done(); paint(); };
            const wi = input(sc.window == null ? '' : String(sc.window), { inputmode: 'numeric', placeholder: '60' });
            wi.onchange = () => { const v = parseInt(wi.value, 10); if (v > 0) sc.window = v; else delete sc.window; done(); paint(); };
            card.append(row('At', '24-hour times', ti), row('On', 'mon … sun; empty for every day', di), row('Minutes to do it in', 'from each time; 60 when empty', wi));
          } else {
            const ei = input(String(sc.every || ''), { inputmode: 'numeric' });
            ei.onchange = () => { sc.every = parseInt(ei.value, 10) || sc.every; done(); paint(); };
            card.appendChild(row('Every (minutes)', '60 for hourly; counted from midnight, or from an item\'s first save', ei));
            // 0.56: any structure, by its name, and a While formula over its items (the structure's Still open rule when empty).
            const each = sc.forEach || sc.forEachOpen || '';
            // Item by item (0.60): structures whose kind opens and closes (and any without a kind, from before kinds).
            const fo = select([['', 'No: once for where it runs (below)']].concat(userStructures().filter(st => st.id === each || !FP.kinds || FP.kinds.opensAndCloses(st.id) || !st.kind).map(st => [st.id, `Each item of ${st.label || st.id}`])), each);
            fo.onchange = () => { delete sc.forEachOpen; if (fo.value) { sc.forEach = fo.value; delete sc.per; } else { delete sc.forEach; delete sc.while; } done(); paint(); };
            card.appendChild(row('Item by item', 'one series for each item of a structure, from its first save; saving this form on the item does it', fo));
            if (each) {
              const rule = FP.structures.has(each) ? FP.structures.get(each).open : null;
              const wf = formulaInput(sc.while || '', v => { if (v && v.trim()) sc.while = v; else delete sc.while; done(); }, rule ? `${rule} (its Still open rule)` : 'e.g. status <> "Ended"', formulaHelp(false, ['status', 'firstAt', 'lastAt', 'lastAction', 'entryCount'].concat(Object.keys((FP.structures.has(each) && FP.structures.get(each).containers) || {}))));
              card.appendChild(row('While', rule ? 'a formula over the item; empty uses the structure\'s Still open rule' : 'a formula over the item: its values, status, firstAt, lastAt; the structure has no Still open rule, so say one here', wf));
            }
          }
          if (!(sc.forEach || sc.forEachOpen)) {
            const pe = select([['group', 'Each terminal group (a terminal in none: itself)'], ['terminal', 'Each terminal'], ['site', 'Each site']], sc.per || (sc.owner && !sc.owner.signedIn ? 'site' : 'group'));
            pe.onchange = () => { sc.per = pe.value; done(); paint(); };
            card.appendChild(row('Once for', 'where it runs; a save anywhere in it counts', pe));
          }
          const gi = input(sc.grace == null ? '' : String(sc.grace), { inputmode: 'numeric', placeholder: String(FP.due.graceOf(sc)) });
          gi.onchange = () => { const v = parseInt(gi.value, 10); if (gi.value.trim() === '') delete sc.grace; else if (v >= 0) sc.grace = v; done(); paint(); };
          card.appendChild(row('Late, then missed after (minutes)', 'it can still be done, late, for this long', gi));
          const o = sc.owner || {};
          const ow = select([['signedIn', 'Whoever is signed in where it is due'], ['pool', 'Everyone with a role or in a department']], o.signedIn === false || o.role || o.department ? 'pool' : 'signedIn');
          ow.onchange = () => { sc.owner = ow.value === 'signedIn' ? { signedIn: true } : { role: 'supervisor' }; done(); paint(); };
          card.appendChild(row('Who is responsible', 'signed in: each person for the time they are signed in; a role or department: anyone in it can do it, and that closes it for all', ow));
          if (!(sc.owner && sc.owner.signedIn)) {
            const rs = select([['', 'Any role'], ...FP.users.ROLES.map(r => [r, `${FP.users.ROLE_LABEL[r]} and up`])], o.role || '');
            const dp = input(o.department || '', { placeholder: 'e.g. Quality', spellcheck: false });
            const setPool = () => { sc.owner = {}; if (rs.value) sc.owner.role = rs.value; if (dp.value.trim()) sc.owner.department = dp.value.trim(); done(); };
            rs.onchange = () => { setPool(); paint(); }; dp.onchange = () => { setPool(); paint(); };
            card.append(row('Role', null, rs), row('Department', 'as written on each person; empty for any', dp));
          }
          const cl = el('label', 'ffe-check'); const ci = input('', { type: 'checkbox' }); ci.checked = !!sc.critical;
          ci.onchange = () => { if (ci.checked) sc.critical = true; else { delete sc.critical; if (sc.notify) delete sc.notify.failure; } done(); paint(); };
          cl.append(ci, document.createTextNode('Critical: tell people as soon as it is late, and send a failure notice when it is missed'));
          card.appendChild(cl);
          sc.notify = sc.notify || {};
          card.appendChild(whoTold(sc.notify, 'missed', 'Told when it is missed'));
          if (sc.critical) card.appendChild(whoTold(sc.notify, 'failure', 'Told of a failure'));
          if (!Object.keys(sc.notify).length) delete sc.notify;
          card.appendChild(el('p', 'ffe-note', 'Emails go out once the Send flow is set up (Admin › Automation). Until then, misses show on the launcher and in Admin › Due.'));
          card.appendChild(btn('Remove this schedule', 'small', () => { draft.due.splice(i, 1); done(); paint(); }));
          list.appendChild(card);
        });
        list.appendChild(btn('+ When it is due', 'small', () => {
          draft.due = draft.due || [];
          const used = new Set(draft.due.map(x => x.name));
          let n = 'due', k = 1; while (used.has(n)) n = 'due' + (++k);
          draft.due.push({ name: n, every: 60, owner: { signedIn: true } });
          done(); paint();
        }));
      };
      paint();
      return wrap;
    }

    /* The map itself. */
    let inspectRow = null;   // the open row: its settings show on the right
    /* The Fields tab (0.58): the form as it shows, section by section, a row per field or button on it; then what
     * isn't on it, and + field. Tapping a section, panel, tab or step picks it (its settings on the right). */
    function fieldsOutline(box, row, addRow) {
      const h = el('div', 'ffm-h'); h.append(el('b', null, 'On the form'), el('span', null, 'in the order it shows')); box.appendChild(h);
      const lay = Array.isArray(draft.layout) ? draft.layout : draft.fields.map(f => [f.name]);
      const cellRow = (name, depth) => {
        const f = byName(name);
        if (f) {
          const d = FP.forms.describe(f.control);
          row(box, { key: 'f:' + f.name, depth, color: catColor(d && d.category), title: () => (f.label || f.name) + (f.required ? ' *' : ''),
            sub: () => { const w = target(f.writes || f.snapshot); return [d ? d.label : f.control, w ? `saves ${w.structure}.${w.container}` : null, f.formula ? `= ${f.formula}` : null, f.when ? 'sometimes shown' : null].filter(Boolean).join(' · '); },
            props: p => fieldProps(f, p) });
          return;
        }
        const b = (draft.buttons || []).find(x => x && x.name === name);
        if (b) row(box, { key: 'b:' + b.name, depth, color: '#eb6834', title: () => b.label || b.name, sub: () => 'button', props: p => buttonProps(b, p) });
      };
      const blockRow = (text, path, depth) => {
        const r = el('button', 'ffm-blk' + (state.block === path ? ' on' : ''));
        r.type = 'button';
        r.dataset.path = path;
        r.style.marginLeft = depth * 14 + 'px';
        r.textContent = text;
        r.onclick = () => { state.block = state.block === path ? null : path; state.open = null; hard(); markSelected(); };
        box.appendChild(r);
      };
      (function walk(rows, path, depth) {
        if (!(rows || []).length && path) box.appendChild(Object.assign(el('div', 'ffo-empty', 'Empty: drag a field here on the form, or use Move to…'), { style: `margin-left:${depth * 14}px` }));
        (rows || []).forEach((r, ri) => {
          if (Array.isArray(r)) { r.forEach(c => cellRow(String(c).trim().split(/\s+/)[0], depth)); return; }
          if (!r || typeof r !== 'object') return;
          const rp = path ? `${path}.${ri}` : String(ri);
          if (Array.isArray(r.rows)) { blockRow(`▾ Section${r.section ? ' · ' + r.section : ''}${r.fold ? ' · folds' : ''}`, rp, depth); walk(r.rows, `${rp}.rows`, depth + 1); }
          ['panels', 'tabs', 'steps'].forEach(k => {
            if (!Array.isArray(r[k])) return;
            blockRow(`▾ ${k === 'panels' ? 'Panels' : k === 'tabs' ? 'Tabs' : 'Steps'}`, rp, depth);
            r[k].forEach((t, i) => {
              if (!t) return;
              const nm = t.panel || t.tab || t.step || '';
              box.appendChild(Object.assign(el('div', 'ffo-sub', `${k === 'panels' ? 'Panel' : k === 'tabs' ? 'Tab' : 'Step'}${nm ? ' · ' + nm : ` ${i + 1}`}`), { style: `margin-left:${(depth + 1) * 14}px` }));
              walk(t.rows, `${rp}.${k}.${i}.rows`, depth + 2);
            });
          });
        });
      })(lay, '', 1);
      const placed = placedNames(lay);
      const loose = draft.fields.filter(f => !placed.has(f.name));
      const looseB = (draft.buttons || []).filter(b => b && !placed.has(b.name));
      if (loose.length || looseB.length) {
        const h2 = el('div', 'ffm-h'); h2.append(el('b', null, 'Not on the form'), el('span', null, 'worked out or saved, not shown')); box.appendChild(h2);
        loose.forEach(f => cellRow(f.name, 1));
      }
      addRow(box, '+f', '+ field', 1, p => {
        p.appendChild(el('p', 'ffe-note', 'Most fields come from Data: tick a value read or write on a source and make its field there. Add one here for anything else: a reference, a note, a chart.'));
        p.appendChild(controlGrid(ctrl => {
          const d = FP.forms.describe(ctrl);
          const f = placeField({ name: nameFrom(d.label, takenNames()), label: d.label, control: ctrl });
          state.open = 'f:' + f.name; changed(); hard();
        }));
      });
    }
    function mapPane() {
      const box = el('div', 'ffm');
      const reg = [];
      marks.clear();
      inspectRow = null;
      const tab = state.left;
      const tag = (t, cls) => el('span', 'ffm-tag ' + (cls || ''), t);
      // One row: a coloured bar, a title, a line of detail, tools on the right; tapping it opens its settings under it.
      function row(parent, o) {
        const r = el('div', 'ffm-r' + (o.cls ? ' ' + o.cls : '') + (state.open === o.key ? ' on' : ''));
        r.dataset.key = o.key;
        r.style.setProperty('--c', o.color || '#64748b');
        r.style.marginLeft = `${(o.depth || 0) * 14}px`;
        const t = el('b', 't'); const d = el('span', 'd'); const extra = el('span', 'x');
        const body = el('span', 'body'); body.append(t, d);
        // Every part of the form says whether it is right: ✓, or ✗ with what to fix just under it.
        const checked = MARKED.test(o.key);
        const mark = checked ? el('span', 'ffm-mark') : null;
        if (mark) r.appendChild(mark);
        r.append(body, extra);
        if (o.tools) o.tools.forEach(x => r.appendChild(x));
        const upd = () => { t.textContent = o.title(); d.textContent = o.sub ? o.sub() : ''; extra.replaceChildren(...(o.tags ? o.tags() : [])); };
        upd();
        reg.push(upd);
        r.onclick = e => { if (e.target.closest('button,input,select,label')) return; if (o.act) o.act(); else open(o.key); };
        parent.appendChild(r);
        if (checked) {
          const errs = el('div', 'ffm-errs');
          errs.style.marginLeft = `${(o.depth || 0) * 14 + 8}px`;
          parent.appendChild(errs);
          marks.set(o.key, { mark, errs, row: r });
        }
        if (state.open === o.key && o.props) inspectRow = o;
        return r;
      }
      const addRow = (parent, key, text, depth, props, act) => row(parent, { key, cls: 'add', color: '#c9d0d9', depth, title: () => text, props, act });
      const head = (text, help) => { const h = el('div', 'ffm-h'); h.append(el('b', null, text)); if (help) h.append(el('span', null, help)); box.appendChild(h); };
      const mv = (list, i, dlt) => btn(dlt < 0 ? '↑' : '↓', 'mv', e => { e.stopPropagation(); const j = i + dlt; if (j < 0 || j >= list.length) return; list.splice(j, 0, list.splice(i, 1)[0]); changed(); hard(); });

      // The form (on Form)
      const doc = FP.defs.get('form', ctx.id);
      if (tab !== 'form') { /* on Form */ } else if (subOf) row(box, { key: 'form', color: '#1b2633', cls: 'top', title: () => draft.label || draft.name, sub: () => `a sub-form of ${subOf.master.title || subOf.masterId}`,
        tools: [btn(`‹ Back to ${subOf.master.title || subOf.masterId}`, 'small', e => { e.stopPropagation(); subOf.back(); })],
        props: p2 => {
          p2.appendChild(el('p', 'ffe-note', `Its fields and sources are here; it reads ${subOf.master.title || 'the master form'}'s fields and sources by name${FP.forms.repeatKind(subOf.sf) !== 'once' ? ', and index (1, 2, …) and each (the list item) for the run it is on' : ''}. How it is opened, how many times, how it saves and what it sends back are on its row in ${subOf.master.title || 'the master form'}.`));
          p2.appendChild(btn(`‹ Back to ${subOf.master.title || subOf.masterId}`, 'small', () => subOf.back()));
        } });
      else row(box, { key: 'form', color: '#1b2633', cls: 'top', title: () => draft.title || ctx.id, sub: () => [doc ? `v${doc.version}` : 'new', (draft.sites || []).join(', '), draft.launchable ? 'has its own launcher' : 'opened from other forms', draft.approval ? 'needs approval' : null, draft.print ? 'prints' : null].filter(Boolean).join(' · '), props: settingsProps });

      // Sources (on Data)
      if (tab === 'data') head('Sources', 'the data this form works with');
      if (tab === 'data') draft.sources.forEach((x, i) => {
        const color = KIND_COLOR[x.kind] || '#64748b';
        row(box, {
          key: 's:' + x.name, depth: 1, color, cls: 'src',
          title: () => x.name, sub: () => (x.kind === 'value' ? `= ${x.formula || '?'}` : x.structure || 'choose a structure'),
          tags: () => [tag(x.kind === 'value' ? 'formula' : 'structure', 'k')],
          tools: [mv(draft.sources, i, -1)], props: p => sourceProps(x, p),
        });
        if (x.kind === 'value' || !x.structure) {
          const rd = readersOfSource(x);
          if (x.kind === 'value' && rd.length) row(box, { key: 'r:' + x.name, depth: 2, color: '#d6ccfb', cls: 'val', title: () => '→', sub: () => rd.map(f => f.label || f.name).join(', ') });
          return;
        }
        // The ID first: where it comes from picks the item (or items) every value under it belongs to.
        const unset = !isList(x) && !((x.id || {}).field || (x.id || {}).generate || (x.id || {}).fixed);
        row(box, {
          key: 'id:' + x.name, depth: 2, color: unset ? '#e5484d' : '#0e7490', cls: 'val idrow' + (unset ? ' unset' : ''),
          title: () => (/\bID$/.test(idLabel(x.structure)) ? idLabel(x.structure) : `${idLabel(x.structure)} (ID)`), sub: () => idSource(x),
          tags: () => [tag(isList(x) ? 'list' : '1 item', 'k')],
          props: p => idProps(x, p),
        });
        // Its values: the ones this form reads or writes, then the rest to add.
        const ticked = Object.keys(x.values || {});
        ticked.forEach(c => {
          const u = () => useOf(x, c);
          const pill = (label, on, flip) => { const b = btn(label, 'ffm-pill' + (on ? ' on ' + label : ''), e => { e.stopPropagation(); flip(); }); return b; };
          row(box, {
            key: `v:${x.name}:${c}`, depth: 2, color: '#9fd3dc', cls: 'val',
            title: () => c,
            sub: () => {
              const fl = fillersOf(x, c).map(f => `← ${f.label || f.name}`);
              const rd = readersOf(x, c).map(f => `→ ${f.label || f.name}`);
              const miss = writes(u()) && !fl.length ? ['nothing fills it'] : [];
              return fl.concat(rd, miss).join('   ');
            },
            tags: () => [
              pill('read', reads(u()), () => { setUse(x, c, !reads(u()), writes(u())); changed(); hard(); }),
              pill('write', writes(u()), () => { const w = !writes(u()); if (w && (FP.sources.BUILT_IN.includes(x.structure) || containersOf(x.structure).some(([n, k]) => n === c && k !== 'container'))) { toast(`${c} can only be read.`, true); return; } setUse(x, c, reads(u()), w); if (!w) unfill(x, c); changed(); hard(); }),
            ],
            props: p => valueProps(x, c, p),
          });
        });
        addRow(box, '+v:' + x.name, `+ value of ${x.structure}`, 2, p => {
          const rest = containersOf(x.structure).map(([n]) => n).filter(n => !ticked.includes(n));
          p.appendChild(el('div', 'fpe-hint', rest.length ? 'Tap a value to use it on this form (it starts as read; tick write on its row to save to it):' : `Every value ${x.structure} has is on the map.`));
          if (rest.length) p.appendChild(chips(rest.map(n => [n, 'container']), n => { setUse(x, n, true, false); state.open = `v:${x.name}:${n}`; changed(); hard(); }));
          if (!FP.sources.BUILT_IN.includes(x.structure)) p.appendChild(btn('+ New value in the structure…', 'small', async () => {
            const n = prompt(`Name of the new value in ${x.structure} (letters and digits, e.g. speed):`);
            if (!n || !NAME_RE.test(n.trim())) return;
            const r2 = await FP.editor.editStructure(x.structure, { container: n.trim() });
            if (r2 && r2.container) { setUse(x, r2.container, false, true); state.open = `v:${x.name}:${r2.container}`; changed(); hard(); }
          }));
        });
      });
      if (tab === 'data') addRow(box, '+s', '+ source', 1, p => {
        const g = el('div', 'ffe-pick');
        [['item', 'A structure', 'Its items: one (the record a save adds to, or one to read) or a list (all of them, or all where…).'], ['value', 'A formula', 'A lookup or calculation, worked out once and read by name: CurrentSpec(profile, "od").']].forEach(([k, label, help]) => {
          const b = btn('', null, () => { const x = addSource(k); if (k === 'item') x.values = {}; state.open = 's:' + x.name; changed(); hard(); });
          b.append(document.createTextNode(label), el('small', null, help));
          b.style.borderLeft = `5px solid ${KIND_COLOR[k]}`;
          g.appendChild(b);
        });
        p.appendChild(g);
      });

      // Fields (on Fields): the form's outline, as it shows: sections, panels, tabs and steps with their fields.
      if (tab === 'fields') fieldsOutline(box, row, addRow);
      // Buttons (a sub-form has its own: Done, or Save when it saves on its own); they and the rest are on Form.
      if (!subOf && tab === 'form') head('Buttons');
      if (subOf || tab !== 'form') { /* none */ } else if (!Array.isArray(draft.buttons)) {
        row(box, { key: 'b:__one', depth: 1, color: '#eb6834', title: () => draft.saveLabel || 'Save', sub: () => 'the one button: saves the whole form', props: p => {
          p.appendChild(el('p', 'ffe-note', 'Set up buttons to name what a save does, save part of the form, open another form, or save a form with the records it opened.'));
          p.appendChild(btn('Set up buttons', 'small', () => { draft.buttons = [{ name: 'save', label: draft.saveLabel || 'Save', action: 'save' }]; state.open = 'b:save'; changed(); hard(); }));
        } });
      } else {
        draft.buttons.forEach((b, i) => {
          row(box, {
            key: 'b:' + b.name, depth: 1, color: '#eb6834', title: () => b.label || b.name,
            sub: () => (b.action === 'subform' ? `opens the sub-form ${((draft.subforms || []).find(x => x && x.name === b.subform) || {}).label || b.subform || '?'}` : b.action === 'open' ? `opens ${b.form || '?'}${b.link ? `, linked to ${b.link}` : ''}` : b.action === 'set' ? `fills in ${Object.keys(b.sets || {}).join(', ') || 'nothing yet'}` : b.action === 'save' ? `${b.scope === 'tree' ? 'saves the form and the records it opened' : b.scope ? 'saves part of the form' : 'saves the form'}${b.saveAs ? ` as "${b.saveAs}"` : ''}` : 'applies') + (b.when ? ' · sometimes shown' : ''),
            tools: [mv(draft.buttons, i, -1)], props: p => buttonProps(b, p),
          });
          // A form it opens: shown in place; editing it opens that form.
          if (b.action === 'open' && b.form) {
            let m = null;
            try { m = FP.map.form(b.form); } catch (_) { m = null; }
            const unfolded = state.open === 'kid:' + b.name;
            row(box, { key: 'kid:' + b.name, depth: 2, color: '#f6c3a8', cls: 'val', title: () => `${unfolded ? '▾' : '▸'} ${(m && m.title) || b.form}`, sub: () => (m ? `${m.fields.length} fields · tap to ${unfolded ? 'fold' : 'look inside'}` : 'not published'),
              tools: ctx.open ? [btn('Edit ›', 'small', e => { e.stopPropagation(); ctx.open('form', b.form); })] : [] });
            if (unfolded && m) {
              (m.sources || []).forEach(s2 => row(box, { key: 'kid:' + b.name + ':s:' + s2.name, depth: 3, color: '#c7e3ea', cls: 'kid', title: () => s2.name, sub: () => s2.text, act: () => {} }));
              m.fields.forEach(f2 => row(box, { key: 'kid:' + b.name + ':f:' + f2.name, depth: 3, color: '#cfe0f7', cls: 'kid', title: () => f2.label || f2.name, sub: () => [f2.kindLabel || f2.control, f2.writes ? `saves ${f2.writes.structure ? `${f2.writes.structure}.${f2.writes.container}` : f2.writes}` : null].filter(Boolean).join(' · '), act: () => {} }));
            }
          }
        });
        addRow(box, '+b', '+ button', 1, null, () => {
          const b = { name: nameFrom('button', takenNames()), label: 'Button', action: 'save' };
          draft.buttons.push(b); state.open = 'b:' + b.name; changed(); hard();
        });
      }

      // Sub-forms
      if (!subOf && tab === 'form') {
        head('Sub-forms', 'a form inside this one, opened by a button');
        (Array.isArray(draft.subforms) ? draft.subforms : []).forEach((sf, i) => {
          const kind = FP.forms.repeatKind(sf);
          const by = (draft.buttons || []).filter(b => b && b.action === 'subform' && b.subform === sf.name).map(b => b.label || b.name);
          row(box, {
            key: 'sf:' + sf.name, depth: 1, color: '#7c3aed', title: () => sf.label || sf.name,
            sub: () => [by.length ? `opened by ${by.join(', ')}` : 'no button opens it',
              kind === 'count' ? `${typeof sf.repeat.count === 'number' ? sf.repeat.count : '= ' + sf.repeat.count} times` : kind === 'list' ? `once for each of ${sf.repeat.list}` : kind === 'open' ? 'as many as needed' : null,
              subSaves(sf) ? (sf.saves === 'own' ? 'saves on its own' : 'saved with this form') : null,
              (sf.back || []).length ? `sends back ${(sf.back || []).length}` : null, sf.required ? 'required' : null].filter(Boolean).join(' · '),
            tags: () => [tag(`${(sf.fields || []).length} field${(sf.fields || []).length === 1 ? '' : 's'}`, 'k')],
            tools: [btn('Edit ›', 'small', e => { e.stopPropagation(); editSubform(sf); })],
            props: p => subformProps(sf, i, p),
          });
        });
        addRow(box, '+sf', '+ sub-form', 1, null, () => {
          draft.subforms = Array.isArray(draft.subforms) ? draft.subforms : [];
          const name = nameFrom('subform', new Set(Array.from(takenNames()).concat(draft.subforms.map(x => x.name))));
          draft.subforms.push({ name, label: 'Sub-form', fields: [], sources: [] });
          if (!Array.isArray(draft.buttons)) draft.buttons = [{ name: 'save', label: draft.saveLabel || 'Save', action: 'save' }];
          draft.buttons.push({ name: nameFrom('open' + name[0].toUpperCase() + name.slice(1), takenNames()), label: 'Open sub-form', action: 'subform', subform: name });
          state.open = 'sf:' + name; changed(); hard();
        });
      }

      // Read first
      if (!subOf && tab === 'form') head('Read first', 'confirmed before the form can be filled');
      if (!subOf && tab === 'form') {
      const of = (FP.forms.formSettings().find(x => x.name === 'acknowledge') || {}).of || [];
      (Array.isArray(draft.acknowledge) ? draft.acknowledge : []).forEach((a, i) => {
        row(box, { key: 'a:' + i, depth: 1, color: '#c98500', title: () => a.label || a.name || `Item ${i + 1}`, sub: () => `${a.show === 'media' ? `documents${a.where ? ': ' + Object.entries(a.where).map(([k, v]) => `${k} = ${v}`).join(', ') : ': every file of the form\'s media'}` : 'text'} · every ${a.every || (a.show === 'media' ? 'revision' : 'day')}`, props: p => {
          // What it shows decides the boxes below it (documents: which files of the form's media), so that one repaints them.
          of.forEach(x => p.appendChild(settingInput(x, a, () => { changed(); if (x.name === 'show') hard(); else soft(); })));
          p.appendChild(btn('Remove', 'small', () => { draft.acknowledge.splice(i, 1); state.open = null; changed(); hard(); }));
        } });
      });
      addRow(box, '+a', '+ something to read', 1, null, () => {
        draft.acknowledge = Array.isArray(draft.acknowledge) ? draft.acknowledge : [];
        draft.acknowledge.push({ name: nameFrom('read', new Set(draft.acknowledge.map(a => a.name))), label: 'Read before starting', show: 'text', every: 'day' });
        state.open = 'a:' + (draft.acknowledge.length - 1); changed(); hard();
      });
      }

      // Media (0.61: from the media library): entries by name, or every entry with some tags; Media fields and Read
      // first pick from them by tag. A file attached by its path before the library still shows.
      if (!subOf && tab === 'form') {
        head('Media', 'from the media library: entries by name, or every entry with some tags');
        draft.media = Array.isArray(draft.media) ? draft.media : [];
        const L = FP.media.library;
        draft.media.forEach((m, i) => {
          if (m && m.entry) {
            const e = L.get(m.entry);
            row(box, { key: 'md:' + m.entry, depth: 1, color: '#b45309', title: () => (e ? e.name : m.entry) + (e && !e.active ? ' (retired)' : !e ? ' (not in the library)' : ''),
              sub: () => (e ? [FP.media.tagsText(e.tags) || 'no tags', `version ${e.revision}`].join(' · ') : 'gone from the library'),
              tags: () => [tag('library', 'k')], props: p => libEntryProps(m, i, p) });
          } else if (m && m.library) {
            const n = () => L.cached().filter(e => e.active && FP.media.matches(e.tags, m.library)).length;
            row(box, { key: 'mdl:' + i, depth: 1, color: '#b45309', title: () => (Object.keys(m.library).length ? `Every entry tagged ${FP.media.tagsText(m.library)}` : 'Every entry of the library'),
              sub: () => `${n()} now; entries added later with these tags show too`, tags: () => [tag('library', 'k')], props: p => libRuleProps(m, i, p) });
          } else if (m && m.path) {
            row(box, { key: 'md:' + m.path, depth: 1, color: '#b45309', title: () => m.title || FP.media.titleOf(m.path),
              sub: () => [FP.media.tagsText(m.tags) || 'no tags yet', m.path].join(' · '),
              tags: () => [tag(FP.media.isImage(m.path) ? 'image' : (m.path.split('.').pop() || 'file').toLowerCase(), 'k')],
              props: p => mediaProps(m, i, p) });
          }
        });
        addRow(box, '+md', '+ from the library', 1, p => libPicker(p));
        addRow(box, '+mdl', '+ every library entry tagged…', 1, p => {
          p.appendChild(el('p', 'ffe-note', 'Every entry of the library with these tags, now and later: a new setup sheet tagged kind: setup sheet shows here without changing the form. Media fields narrow it further, e.g. by die.'));
          p.appendChild(btn('Add it', 'small', () => { draft.media.push({ library: {} }); state.open = 'mdl:' + (draft.media.length - 1); changed(); hard(); }));
        });
      }

      // Opened by
      let m0 = null;
      try { m0 = FP.map.form(ctx.id); } catch (_) { m0 = null; }
      if (m0 && m0.openedBy.length && !subOf && tab === 'form') {
        head('Opened by');
        m0.openedBy.forEach(o => row(box, { key: 'by:' + o.form, depth: 1, color: '#b45309', title: () => o.title, sub: () => `its ${o.button} button${o.link ? `, linked to its ${o.link} item` : ''}`, tools: ctx.open ? [btn('Edit ›', 'small', e => { e.stopPropagation(); ctx.open('form', o.form); })] : [] }));
      }
      soft = () => reg.forEach(u => u());
      paintMarks();
      return box;
    }

    function controlGrid(pick) {
      const g = el('div', 'ffe-pick');
      [['entry', 'Entry'], ['display', 'Display'], ['visual', 'Visuals']].forEach(([cat, title]) => {
        const list = FP.forms.controls().filter(c => c.category === cat);
        if (!list.length) return;
        g.appendChild(el('h5', null, title));
        list.forEach(c => {
          const b = btn('', null, () => pick(c.name));
          b.appendChild(document.createTextNode(c.label));
          b.appendChild(el('small', null, c.value ? `saves ${c.value}` : c.data ? `shows ${c.data}` : (c.help || '')));
          b.style.borderLeft = `5px solid ${catColor(cat)}`;
          g.appendChild(b);
        });
      });
      return g;
    }

    /* ---------- Cells of the layout: a field's name and its width ("profile 6") ----------
     * One width per field (0.48): an older pc:N is read as N; tablet:N and phone:N are dropped when the cell is next written. */
    const parseCell = text => {
      const [name, ...rest] = String(text).trim().split(/\s+/);
      const c = { name, base: null, other: [] };
      const SIZES = { s: 3, m: 4, l: 6, full: 12 };
      rest.forEach(t => {
        const w = /^(?:(pc|tablet|phone):)?([a-z]+)$/i.exec(t);
        if (w && SIZES[w[2].toLowerCase()]) { if (!w[1] || w[1] === 'pc') c.base = c.base || SIZES[w[2].toLowerCase()]; return; }
        const m = /^(?:(pc|tablet|phone):)?(\d{1,2})$/.exec(t);
        if (!m) c.other.push(t); else if (!m[1] || m[1] === 'pc') c.base = m[1] ? c.base || Number(m[2]) : Number(m[2]);
      });
      return c;
    };
    const cellText = c => [c.name, c.base].concat(c.other).filter(x => x != null && x !== '').join(' ');
    /* ---------- The outline on the left, the settings on the right ---------- */
    function paintSub() { sub.hidden = true; }
    function paintPane() { pane.replaceChildren(mapPane()); paintTabs(); paintInspector(); }
    hard = pointerSafe(root, () => { paintPane(); markSelected(); });
    state.tab = 'map';

    /* ---------- The form in the middle: Edit (pick, drag, size) or Try it (working) ---------- */
    if (state.mode !== 'try') state.mode = 'edit';
    const ph = el('header', 'ffe3-bar');
    const modeSel = el('div', 'ffa-mode');
    const widthSel = select([['pc', 'PC'], ['tablet', 'Tablet'], ['phone', 'Phone']], state.width);
    widthSel.title = 'Show the form on: a kind of screen, or a terminal\'s own recorded screen';
    const sampleSel = select([['', 'blank']], '');
    sampleSel.title = 'Fill the form from a saved item while you edit, so its values and lists show';
    const sampleLab = el('label', 'ffe3-with'); sampleLab.append(el('span', null, 'Show with'), sampleSel);
    sampleLab.hidden = true;
    const zoomSel = select([['fit', 'Fit'], ['100', '100%']], state.zoom || 'fit');
    zoomSel.title = 'Draw a terminal\'s screen to fit, or at its real size (scroll to see it all)';
    zoomSel.onchange = () => { state.zoom = zoomSel.value; rescale(); placeSel(); };
    ph.append(modeSel, widthSel, zoomSel, sampleLab);
    const frame = el('div', 'ffe-frame');
    const msg = el('div', 'ffe-note');
    const fitNote = el('div', 'ffo-fit');
    fitNote.hidden = true;
    const stage = el('div', 'ffo-stage ffe3-stage');
    // The picked field's outline, its name and size, and the handle that sizes it; the drop line while dragging.
    const selBox = el('div', 'ffe3-sel'); selBox.hidden = true;
    const selTag = el('span', 'ffe3-seltag');
    const handle = el('span', 'ffe3-handle'); handle.title = 'Drag to size it: S, M, L or Full';
    selBox.append(selTag, handle);
    const dropLine = el('div', 'ffe3-drop'); dropLine.hidden = true;
    stage.append(fitNote, frame, selBox, dropLine);
    const hint = el('div', 'ffe3-hint', 'Click to pick · drag to move · drag the right edge to size it (S · M · L · Full)');
    prev.append(ph, msg, stage, hint);
    // The form uses the chosen device's widths whatever the pane's size (the form is told which device it is),
    // and tablets and phones are drawn at their own width.
    const W = { pc: '100%', tablet: '768px', phone: '390px' };
    const fit = () => { frame.style.maxWidth = screenNow() ? '' : W[state.width]; };
    const paintMode = () => modeSel.replaceChildren(...[['edit', 'Edit'], ['try', 'Try it']].map(([k, t]) => { const b = btn(t, state.mode === k ? 'on' : '', () => { state.mode = k; state.modeChosen = true; state.block = null; paintMode(); fit(); hard(); paintPreview(); }); b.setAttribute('aria-pressed', String(state.mode === k)); return b; }));
    paintMode();
    widthSel.onchange = () => {
      const v = widthSel.value;
      if (v.startsWith('t:')) state.screen = v.slice(2); else { state.screen = null; state.width = v; }
      fit(); paintPreview();
    };

    /* Show with (0.58): a saved item fills the form while you edit, through the field its source is found by. */
    const sampleSources = () => (draft.sources || []).filter(x => x && x.kind === 'item' && x.structure && x.id && x.id.field && byName(x.id.field));
    async function loadSamples() {
      const list = sampleSources();
      if (!list.length) { sampleLab.hidden = true; state.sample = null; return; }
      const opts = [['', 'blank']];
      for (const x of list.slice(0, 3)) {
        let items = [];
        try { items = Array.from((await FP.current.load(x.structure)).items.values()).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt))).slice(0, 15); } catch (_) { items = []; }
        const lab = idLabel(x.structure);
        items.forEach(it => opts.push([`${x.id.field}|${it.id}`, `${lab} ${it.id}`]));
      }
      sampleSel.replaceChildren(...opts.map(([v, t]) => { const o = el('option', null, t); o.value = v; return o; }));
      if (state.sample === undefined) state.sample = opts.length > 1 ? opts[1][0] : '';
      sampleSel.value = opts.some(([v]) => v === state.sample) ? state.sample : '';
      sampleLab.hidden = opts.length < 2;
    }
    sampleSel.onchange = () => { state.sample = sampleSel.value; paintPreview(); };
    const samplePrefill = () => { if (!state.sample) return undefined; const k = state.sample.indexOf('|'); const o = {}; o[state.sample.slice(0, k)] = state.sample.slice(k + 1); return o; };

    /* Terminal screens (0.44): every terminal at the form's sites that has told us its screen. The number pad
     * takes 320 px on the right of a landscape touch screen 900 px or wider, unless its keyboard is off. */
    let screens = null;
    const screenNow = () => (state.screen && screens ? screens.find(x => x.id === state.screen) || null : null);
    async function loadScreens() {
      const out = await recordedScreens((subOf && subOf.master ? subOf.master.sites : draft.sites) || [], subOf && subOf.masterId ? subOf.masterId : ctx.id, subOf && subOf.master ? subOf.master.keyboard : draft.keyboard);
      screens = out;
      if (state.screen === undefined) state.screen = out.length ? out[0].id : null;
      const opts = [['pc', 'PC'], ['tablet', 'Tablet'], ['phone', 'Phone']].map(([v, t]) => { const o = el('option', null, t); o.value = v; return o; });
      if (out.length) {
        const g = el('optgroup'); g.label = 'Terminals (their own screens)';
        out.forEach(x => { const o = el('option', null, `${x.id}${x.name ? ' ' + x.name : ''} · ${x.w}×${x.h}${x.touch ? ' · touch' : ''}${x.runs ? ' · runs it' : ''}`); o.value = 't:' + x.id; g.appendChild(o); });
        opts.push(g);
      }
      widthSel.replaceChildren(...opts);
      widthSel.value = screenNow() ? 't:' + state.screen : state.width;
      fit();
    }

    // Where things sit in the layout. The form marks each piece with its path, e.g. "2.tabs.0.rows.1".
    const ensureLayout = () => { if (!Array.isArray(draft.layout)) draft.layout = draft.fields.map(f => [f.name]); return draft.layout; };
    function at(path) {
      let o = ensureLayout();
      if (!path) return o;
      for (const k of String(path).split('.')) { if (o == null) return null; o = /^\d+$/.test(k) ? o[Number(k)] : o[k]; }
      return o;
    }
    const parentList = path => { const parts = String(path).split('.'); const i = Number(parts.pop()); return { list: at(parts.join('.')), index: i }; };
    const cellOf = name => { let out = null; (function walk(rows) { (rows || []).forEach(r => { if (Array.isArray(r)) r.forEach(c => { if (String(c).trim().split(/\s+/)[0] === name) out = String(c); }); else if (r && typeof r === 'object') { walk(r.rows); (r.tabs || []).forEach(t => t && walk(t.rows)); (r.steps || []).forEach(t => t && walk(t.rows)); (r.panels || []).forEach(t => t && walk(t.rows)); } }); })(draft.layout); return out; };
    const DROP = '__drop__';
    // Put a field (or button) at a spot: a new row in a list, or beside a cell in a row. Marked first, so
    // taking the field out of its old place can't shift where it goes.
    function placeBlock(kind, where) {
      const l = at(where.list);
      if (!Array.isArray(l)) return;
      if (kind === 'steps' && (where.list !== '' || draft.layout.some(r => r && r.steps))) { toast('Steps go at the top level, once per form.', true); return; }
      const b = kind === 'section' ? { section: 'Section', rows: [] } : kind === 'panels' ? { panels: [{ panel: 'Panel 1', width: 'narrow', rows: [] }, { panel: 'Panel 2', rows: [] }] }
        : kind === 'tabs' ? { tabs: [{ tab: 'Tab 1', rows: [] }, { tab: 'Tab 2', rows: [] }] } : { steps: [{ step: 'Step 1', rows: [] }, { step: 'Step 2', rows: [] }] };
      l.splice(where.index, 0, b);
      state.block = where.list ? `${where.list}.${where.index}` : String(where.index);
      state.left = 'fields'; state.open = null; changed(); hard(); paintPreview(true);
    }
    // Take a block out: its fields stay, moved up to where the block was.
    function removeBlock(path) {
      const { list, index } = parentList(path);
      const b = list[index];
      const lifted = b.rows ? b.rows : [].concat(...(b.tabs || b.steps || b.panels || []).map(t => (t && t.rows) || []));
      list.splice(index, 1, ...lifted);
      state.block = null; changed(); hard(); paintPreview(true);
    }

    /* ---------- Order (0.44): the layout as a list of fields in order, for fingers as well as a mouse ---------- */
    const KIDS = ['panels', 'tabs', 'steps'];
    // Every field and button on the form, in the order it shows: { name, rows, ri, row, ci }.
    function cellsInOrder(layout) {
      const out = [];
      (function walk(rows) {
        (rows || []).forEach((r, ri) => {
          if (Array.isArray(r)) r.forEach((c, ci) => out.push({ name: String(c).trim().split(/\s+/)[0], rows, ri, row: r, ci }));
          else if (r && typeof r === 'object') { walk(r.rows); KIDS.forEach(k => (r[k] || []).forEach(t => t && walk(t.rows))); }
        });
      })(layout);
      return out;
    }
    const where = name => cellsInOrder(ensureLayout()).find(x => x.name === name) || null;
    const widthOf = (row, ci) => { const c = parseCell(row[ci]); return c.base || Math.max(1, Math.floor(12 / Math.max(1, row.length))); };
    // A row's fields keep the widths they show before the row changes (a bare name shares the row evenly).
    const freeze = row => row.forEach((x, i) => { const c = parseCell(x); if (!c.base) { c.base = widthOf(row, i); row[i] = cellText(c); } });
    function swapIn(text) {
      (function swap(rows) {
        (rows || []).forEach(r => {
          if (Array.isArray(r)) { const k = r.indexOf(DROP); if (k >= 0) r[k] = text; }
          else if (r && typeof r === 'object') { swap(r.rows); KIDS.forEach(k => (r[k] || []).forEach(t => t && swap(t.rows))); }
        });
      })(draft.layout);
    }
    const done = () => { changed(); hard(); paintPreview(true); };
    function moveField(name, dir) {
      const seq = cellsInOrder(ensureLayout());
      const i = seq.findIndex(x => x.name === name), j = i + dir;
      if (i < 0 || j < 0 || j >= seq.length) return;
      const me = seq[i], nb = seq[j];
      freeze(me.row); freeze(nb.row);
      const text = me.row[me.ci];
      nb.row.splice(nb.ci + (dir > 0 ? 1 : 0), 0, DROP);
      unplace(draft.layout, name);
      swapIn(text);
      done();
    }
    function toggleRow(name) {
      const x = where(name);
      if (!x) return;
      freeze(x.row);
      if (x.ci > 0) x.rows.splice(x.ri + 1, 0, x.row.splice(x.ci));
      else if (x.ri > 0 && Array.isArray(x.rows[x.ri - 1])) { freeze(x.rows[x.ri - 1]); x.rows[x.ri - 1].push(...x.row); x.rows.splice(x.ri, 1); }
      else return;
      done();
    }
    function setSize(name, n) {
      const x = where(name);
      if (!x) return;
      freeze(x.row);
      const c = parseCell(x.row[x.ci]);
      c.base = n;
      x.row[x.ci] = cellText(c);
      done();
    }
    function moveTo(name, path) {
      const x = where(name);
      const l = at(path);
      if (!x || !Array.isArray(l)) return;
      const text = x.row[x.ci];
      l.push([DROP]);
      unplace(draft.layout, name);
      swapIn(text);
      done();
    }
    // The lists a field can go in: the top of the form, each section, panel, tab and step.
    function containers() {
      const out = [['', 'Top of the form']];
      (function walk(rows, path, depth) {
        (rows || []).forEach((r, ri) => {
          if (!r || Array.isArray(r) || typeof r !== 'object') return;
          const rp = path ? `${path}.${ri}` : String(ri);
          const pre = '  '.repeat(depth);
          if (Array.isArray(r.rows)) { out.push([`${rp}.rows`, `${pre}Section ${r.section || ri + 1}`]); walk(r.rows, `${rp}.rows`, depth + 1); }
          KIDS.forEach(k => (r[k] || []).forEach((t, i) => {
            if (!t) return;
            const nm = t.panel || t.tab || t.step || `${i + 1}`;
            out.push([`${rp}.${k}.${i}.rows`, `${pre}${k === 'panels' ? 'Panel' : k === 'tabs' ? 'Tab' : 'Step'} ${nm}`]);
            walk(t.rows, `${rp}.${k}.${i}.rows`, depth + 1);
          }));
        });
      })(draft.layout || [], '', 0);
      return out;
    }
    function labelOf(name) {
      const f = draft.fields.find(x => x && x.name === name);
      if (f) { const d = FP.forms.describe ? FP.forms.describe(f.control) : null; return [f.label || name, (d && d.label) || f.control]; }
      const b = (draft.buttons || []).find(x => x && x.name === name);
      return b ? [b.label || name, 'button'] : [name, 'not a field'];
    }

    /* ---------- The settings on the right: of the picked row, the picked section, or the form itself ---------- */
    function placeSet(name) {
      const box = el('div', 'ffe3-place');
      box.appendChild(el('div', 'ffe3-cap', 'On the form'));
      const x = where(name);
      if (!x) {
        box.appendChild(el('div', 'fpe-hint', 'Not on the form: it is worked out or saved, but not shown.'));
        box.appendChild(btn('Put it on the form', 'small', () => { ensureLayout().push([name + ' 12']); done(); }));
        return box;
      }
      const [lab] = labelOf(name);
      const size = widthOf(x.row, x.ci);
      const seg = el('div', 'ffo-seg');
      seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', `Size of ${lab}`);
      [['S', 3], ['M', 4], ['L', 6], ['Full', 12]].forEach(([t, n]) => { const b = btn(t, size === n ? 'on' : '', () => setSize(name, n)); b.setAttribute('aria-pressed', String(size === n)); seg.appendChild(b); });
      if (![3, 4, 6, 12].includes(size)) { const b = btn(`${size}/12`, 'on'); b.disabled = true; seg.appendChild(b); }
      box.appendChild(seg);
      const l2 = el('div', 'ffo-row');
      const up = btn('←', 'ffo-ic', () => moveField(name, -1)); up.setAttribute('aria-label', `Move ${lab} earlier`); up.title = 'Earlier';
      const dn = btn('→', 'ffo-ic', () => moveField(name, 1)); dn.setAttribute('aria-label', `Move ${lab} later`); dn.title = 'Later';
      const starts = x.ci === 0;
      const canJoin = x.ri > 0 && Array.isArray(x.rows[x.ri - 1]);
      const nr = btn('↵ Starts a row', 'ffo-nr small' + (starts ? ' on' : ''), () => toggleRow(name));
      nr.setAttribute('aria-pressed', String(starts));
      nr.title = starts ? (canJoin ? 'Starts a new row: tap to put it on the row above' : 'First in its list, so it starts a row') : 'Tap to start a new row here';
      nr.disabled = starts && !canJoin;
      l2.append(up, dn, nr);
      box.appendChild(l2);
      const mv = select([['', 'Move to…']].concat(containers(), [['__off', 'Take it off the form']]), '');
      mv.onchange = () => { if (mv.value === '__off') { ensureLayout(); unplace(draft.layout, name); done(); } else if (mv.value !== '') moveTo(name, mv.value); };
      box.appendChild(mv);
      return box;
    }
    function formOverview(box) {
      box.appendChild(el('div', 'ffe3-ih', subOf ? (draft.label || draft.name) : (draft.title || ctx.id)));
      box.appendChild(el('p', 'fpe-hint', 'Pick a field on the form, or a row on the left, to change it.'));
      if (!subOf) {
        const sp = el('div', 'ffo-row');
        sp.appendChild(el('span', 'ffo-cap', 'Spacing'));
        const seg = el('div', 'ffo-seg');
        [['comfortable', 'Comfortable'], ['compact', 'Compact']].forEach(([k, t]) => {
          const b = btn(t, (draft.density || 'comfortable') === k ? 'on' : '', () => { if (k === 'compact') draft.density = 'compact'; else delete draft.density; done(); });
          b.setAttribute('aria-pressed', String((draft.density || 'comfortable') === k));
          seg.appendChild(b);
        });
        sp.appendChild(seg);
        box.appendChild(sp);
        // The on-screen keyboard (0.44.5): the terminal's setting, or always for this form.
        const kb = el('div', 'ffo-row');
        kb.appendChild(el('span', 'ffo-cap', 'Keyboard'));
        const kseg = el('div', 'ffo-seg');
        [['terminal', 'Terminal\'s setting'], ['always', 'Always pops up']].forEach(([k, t]) => {
          const on = (draft.keyboard === 'always' ? 'always' : 'terminal') === k;
          const b = btn(t, on ? 'on' : '', () => { if (k === 'always') draft.keyboard = 'always'; else delete draft.keyboard; changed(); hard(); loadScreens().then(() => paintPreview(true)).catch(() => paintPreview(true)); });
          b.setAttribute('aria-pressed', String(on));
          kseg.appendChild(b);
        });
        kb.appendChild(kseg);
        box.appendChild(kb);
      } else box.appendChild(el('div', 'fpe-hint', 'A sub-form has its form\'s spacing.'));
      const add = el('div', 'ffo-row');
      add.appendChild(el('span', 'ffo-cap', 'Add'));
      [['section', 'Section'], ['panels', 'Panels'], ['tabs', 'Tabs'], ['steps', 'Steps']].forEach(([k, t]) => add.appendChild(btn(t, 'small', () => { ensureLayout(); placeBlock(k, { list: '', index: draft.layout.length }); hard(); })));
      box.appendChild(add);
    }
    function paintInspector() {
      insp.replaceChildren();
      if (state.block && Array.isArray(draft.layout)) { const b = blockSettings(); if (b) { insp.appendChild(b); return; } }
      const o = inspectRow;
      if (!o) { formOverview(insp); return; }
      const head = el('div', 'ffe3-ih');
      head.append(el('b', null, o.title()));
      if (o.sub) head.appendChild(el('small', null, o.sub()));
      insp.appendChild(head);
      const mine = byKey().get(o.key) || [];
      if (mine.length) insp.appendChild(el('div', 'ffm-errs ffe3-errs', mine.map(x => '✗ ' + x).join('\n')));
      if ((/^f:/.test(o.key) && byName(o.key.slice(2))) || (/^b:/.test(o.key) && placedNow().has(o.key.slice(2)))) insp.appendChild(placeSet(o.key.slice(2)));
      const p = el('div', 'ffm-props');
      o.props(p);
      insp.appendChild(p);
    }

    /* The settings of a section, a set of tabs or the steps, picked on the Fields outline. */
    function blockSettings() {
      if (!state.block || !Array.isArray(draft.layout)) return null;
      const r = at(state.block);
      if (!r || Array.isArray(r) || typeof r !== 'object') { state.block = null; return null; }
      const box = el('div', 'ffe-props');
      const head = el('div', 'fpe-row');
      head.append(el('b', null, r.section != null || r.rows ? 'Section' : r.panels ? 'Panels' : r.tabs ? 'Tabs' : 'Steps'), btn('Remove it (its fields stay)', 'small', () => removeBlock(state.block)), btn('Done', 'small', () => { state.block = null; hard(); markSelected(); }));
      box.appendChild(head);
      if (!r.tabs && !r.steps && !r.panels) {
        const si = input(r.section || '', { placeholder: 'heading (optional)' });
        si.oninput = () => { if (si.value) r.section = si.value; else delete r.section; changed(); schedulePreview(); };
        const fs = select([['', "doesn't fold"], ['open', 'folds, starts open'], ['closed', 'folds, starts closed']], r.fold || '');
        fs.onchange = () => { if (fs.value) r.fold = fs.value; else delete r.fold; changed(); schedulePreview(); };
        const row = el('div', 'ffe-maprow'); row.append(si, fs); box.appendChild(row);
        const wl = el('label', 'ffe-set'); wl.appendChild(el('span', null, 'Shown only when'));
        wl.appendChild(formulaInput(r.when || '', v => { if (v) r.when = v; else delete r.when; changed(); }, 'optional', formulaHelp()));
        box.appendChild(wl);
      } else {
        const kind = r.tabs ? 'tab' : r.steps ? 'step' : 'panel';
        const items = r.tabs || r.steps || r.panels;
        if (kind === 'panel') box.appendChild(el('div', 'fpe-hint', 'Side by side when the form is 900 px or wider, one above the other when narrower. A panel with no width shares what is left.'));
        items.forEach((t, k) => {
          const row = el('div', 'ffe-maprow');
          const li = input(t[kind] || '', { placeholder: kind === 'panel' ? 'heading (optional)' : `${kind} name` });
          li.oninput = () => { if (kind === 'panel' && !li.value) delete t.panel; else t[kind] = li.value; changed(); schedulePreview(); };
          let ws = null;
          if (kind === 'panel') {
            ws = select([['', 'shares what is left'], ['narrow', 'narrow (320 px)'], ['third', 'a third'], ['half', 'half']], t.width || '');
            ws.onchange = () => { if (ws.value) t.width = ws.value; else delete t.width; changed(); schedulePreview(); };
          }
          const wb = el('div');
          wb.appendChild(formulaInput(t.when || '', v => { if (v) t.when = v; else delete t.when; changed(); }, 'shown when (optional)', formulaHelp()));
          row.append(...[el('span', 'fpe-hint', `${kind} ${k + 1}`), li, ws, wb].filter(Boolean), btn('✕', 'small', () => {
            const lifted = t.rows || [];
            items.splice(k, 1);
            if (!items.length) { const { list, index } = parentList(state.block); list.splice(index, 1, ...lifted); state.block = null; }
            else (items[Math.max(0, k - 1)].rows = items[Math.max(0, k - 1)].rows || []).push(...lifted);
            changed(); paintPreview(true);
          }));
          box.appendChild(row);
        });
        box.appendChild(btn(`+ ${kind}`, 'small', () => { const o = {}; o[kind] = `${kind === 'tab' ? 'Tab' : kind === 'step' ? 'Step' : 'Panel'} ${items.length + 1}`; o.rows = []; items.push(o); changed(); paintPreview(true); }));
      }
      return box;
    }


    // The picked field (or section) lit up on the form, with its outline, name, size and handle on top.
    function markSelected() {
      frame.querySelectorAll('.ffa-sel').forEach(n => n.classList.remove('ffa-sel'));
      const name = state.open && /^[fb]:/.test(state.open) ? state.open.slice(2) : null;
      const c = name ? frame.querySelector(`.fpf-cell[data-name="${window.CSS.escape(name)}"]`) : null;
      if (c) { c.classList.add('ffa-sel'); const r = c.getBoundingClientRect(), fr = prev.getBoundingClientRect(); if (r.top < fr.top || r.bottom > fr.bottom) c.scrollIntoView({ block: 'nearest' }); }
      if (state.block) { const b = frame.querySelector(`[data-path="${window.CSS.escape(state.block)}"][data-block]`); if (b) b.classList.add('ffa-sel'); }
      placeSel();
    }
    function placeSel() {
      const name = state.mode === 'edit' && state.open && /^[fb]:/.test(state.open) ? state.open.slice(2) : null;
      const c = name ? frame.querySelector(`.fpf-cell[data-name="${window.CSS.escape(name)}"]`) : null;
      if (!c || !c.offsetParent) { selBox.hidden = true; return; }
      const r = c.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      selBox.hidden = false;
      const ox = stage.scrollLeft - sr.left, oy = stage.scrollTop - sr.top;
      Object.assign(selBox.style, { left: (r.left + ox - 4) + 'px', top: (r.top + oy - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
      const x = where(name);
      const n = x ? widthOf(x.row, x.ci) : 12;
      selTag.textContent = `${labelOf(name)[0]} · ${({ 3: 'S', 4: 'M', 6: 'L', 12: 'Full' })[n] || n + '/12'}`;
      handle.hidden = !x;
    }
    const focusRow = key => {
      state.left = tabFor(key); state.block = null; state.open = key; hard();
      const r = pane.querySelector(`.ffm-r[data-key="${window.CSS.escape(key)}"]`);
      if (r) r.scrollIntoView({ block: 'nearest' });
    };

    let inst = null, pt = null, seq = 0;
    async function paintPreview(now) {
      clearTimeout(pt);
      const my = ++seq;
      frame.classList.toggle('ffo-on', state.mode === 'edit');
      let def = tidyForm(draft);
      if (subOf) def = Object.assign(FP.forms.subDef(subOf.master, def), { title: draft.label || draft.name });
      const problems = FP.forms.check(def);
      if (problems.length) { msg.replaceChildren(document.createTextNode(`The form shows again once nothing is marked ✗ (${problems.length} to fix). `), btn('Go to the first ›', 'small', () => ctx.goToProblem && ctx.goToProblem())); frame.classList.add('stale'); selBox.hidden = true; return; }
      msg.textContent = state.mode === 'try' ? 'Try it: the form works as it will on a terminal. Nothing is saved here.' : '';
      hint.hidden = state.mode !== 'edit';
      frame.classList.remove('stale');
      const host = el('div');
      try {
        const sc = screenNow();
        const density = subOf && subOf.master ? subOf.master.density : undefined;
        const next = await FP.forms.open(host, ctx.id, Object.assign({ def, preview: true, draft: false, device: sc ? undefined : state.width, density, site: ctx.site || undefined, prefill: subOf ? undefined : samplePrefill() },
          subOf ? { sub: { outer: () => ({}), index: 1, buttons: [{ name: '__main', label: subOf.sf.saves === 'own' && subSaves(subOf.sf) ? 'Save' : 'Done', action: subOf.sf.saves === 'own' && subSaves(subOf.sf) ? 'save' : 'apply' }] } } : {}));
        if (my !== seq) { next.destroy(); return; }
        if (inst) inst.destroy();
        inst = next;
        if (sc) showOnScreen(sc, host);
        else { stageNow = null; fitNote.hidden = true; frame.replaceChildren(host); }
        markSelected();
        // Values and lists settle a moment after the form opens: the outline follows.
        setTimeout(placeSel, 400);
      } catch (e) { if (my === seq) { msg.textContent = `The form can't show yet: ${e.message}`; frame.classList.add('stale'); } }
    }
    function schedulePreview() { clearTimeout(pt); pt = setTimeout(paintPreview, 450); }

    /* A terminal's screen (0.44): the launcher's bar, the form at the width it gets there (less the number pad),
     * and a line where the screen ends. Drawn smaller when the pane is narrower than the screen. */
    let stageNow = null;
    function showOnScreen(sc, host) {
      const compact = (subOf && subOf.master ? subOf.master.density : draft.density) === 'compact';
      const wrap = el('div', 'ffo-screen');
      wrap.style.width = sc.w + 'px';
      const scr = el('div', 'ffo-scr');
      scr.style.width = (sc.w - sc.pad) + 'px';
      scr.style.minHeight = sc.h + 'px';
      const bar = el('div', 'ffo-bar', (subOf && subOf.master ? subOf.master.title : draft.title) || ctx.id);
      const main = el('div', 'ffo-main');
      main.style.maxWidth = (compact ? 1680 : 1100) + 'px';
      main.style.paddingTop = (compact ? 12 : 18) + 'px';
      main.appendChild(host);
      scr.append(bar, main);
      wrap.appendChild(scr);
      if (sc.pad) { const pad = el('div', 'ffo-pad'); pad.style.height = sc.h + 'px'; pad.append(el('b', null, 'Number pad'), el('span', null, `opens here on ${sc.id} when a number field is tapped`)); wrap.appendChild(pad); }
      const below = el('div', 'ffo-below'); below.style.top = sc.h + 'px';
      const fold = el('div', 'ffo-fold'); fold.style.top = sc.h + 'px'; fold.appendChild(el('span', null, `${sc.id}'s screen ends here`));
      wrap.append(below, fold);
      const sizer = el('div', 'ffo-sizer');
      sizer.appendChild(wrap);
      frame.replaceChildren(sizer);
      stageNow = { sc, wrap, scr, main, sizer };
      if (ro) ro.observe(main);
      rescale();
    }
    function rescale() {
      const st = stageNow;
      if (!st || !st.wrap.isConnected) return;
      const z = state.zoom === '100' ? 1 : Math.min(1, Math.max(200, frame.clientWidth - 20) / st.sc.w);
      const used = 60 + st.main.offsetHeight;
      st.wrap.style.transform = `scale(${z})`;
      st.sizer.style.width = Math.ceil(st.sc.w * z) + 'px';
      st.sizer.style.height = Math.ceil((Math.max(used, st.sc.h) + 40) * z) + 'px';
      const spare = st.sc.h - used;
      const sz = `${st.sc.id} (${st.sc.w}×${st.sc.h})`;
      fitNote.hidden = false;
      fitNote.className = 'ffo-fit ' + (spare >= 0 ? 'ok' : 'over');
      fitNote.textContent = (spare >= 0 ? `Fits on ${sz} with ${spare} px to spare` : `Scrolls ${-spare} px on ${sz}`)
        + (st.sc.pad ? ' · keeps the number pad\'s space' : '') + (z < 1 ? ` · shown at ${Math.round(z * 100)}%` : '');
      frame.dataset.fit = spare >= 0 ? 'ok' : String(-spare);
    }
    const ro = window.ResizeObserver ? new ResizeObserver(() => requestAnimationFrame(() => { rescale(); placeSel(); })) : null;
    if (ro) ro.observe(prev);
    prev.addEventListener('scroll', () => placeSel(), { passive: true });
    stage.addEventListener('scroll', () => placeSel(), { passive: true });
    window.addEventListener('scroll', () => { if (root.isConnected) placeSel(); }, { passive: true });

    /* ---------- Edit: pick, drag to move, drag the edge to size ---------- */
    const cellAt = (x, y, except) => {
      const els = document.elementsFromPoint(x, y);
      for (const e of els) { const c = e.closest && e.closest('.fpf-cell[data-name]'); if (c && frame.contains(c) && c.dataset.name !== except) return c; }
      return null;
    };
    // Where a drop lands: beside a field (before or after it in its row), or a new row above or below its row.
    function dropAt(ev, name) {
      const c = cellAt(ev.clientX, ev.clientY, name);
      if (!c) return null;
      const r = c.getBoundingClientRect();
      const fy = (ev.clientY - r.top) / Math.max(1, r.height), fx = (ev.clientX - r.left) / Math.max(1, r.width);
      const how = fy < 0.22 ? 'above' : fy > 0.78 ? 'below' : fx < 0.5 ? 'before' : 'after';
      return { target: c.dataset.name, how, rect: r };
    }
    function showDrop(d) {
      if (!d) { dropLine.hidden = true; return; }
      const sr0 = stage.getBoundingClientRect(), r = d.rect;
      const sr = { left: sr0.left - stage.scrollLeft, top: sr0.top - stage.scrollTop };
      dropLine.hidden = false;
      dropLine.className = 'ffe3-drop ' + (d.how === 'above' || d.how === 'below' ? 'h' : 'v');
      if (d.how === 'before' || d.how === 'after') Object.assign(dropLine.style, { left: ((d.how === 'before' ? r.left - 6 : r.right + 3) - sr.left) + 'px', top: (r.top - sr.top) + 'px', width: '3px', height: r.height + 'px' });
      else Object.assign(dropLine.style, { left: (r.left - sr.left) + 'px', top: ((d.how === 'above' ? r.top - 7 : r.bottom + 4) - sr.top) + 'px', width: r.width + 'px', height: '3px' });
    }
    // Move a field to beside another, or onto a new row above or below that one's row.
    function moveNear(name, target, how) {
      if (name === target) return;
      const me = where(name), t = where(target);
      if (!me || !t) return;
      freeze(me.row); freeze(t.row);
      const text = me.row[me.ci];
      if (how === 'before' || how === 'after') t.row.splice(t.ci + (how === 'after' ? 1 : 0), 0, DROP);
      else t.rows.splice(t.ri + (how === 'below' ? 1 : 0), 0, [DROP]);
      unplace(draft.layout, name);
      swapIn(text);
      done();
    }
    let press = null, suppressClick = false;
    const pickCell = e => {
      if (state.mode !== 'edit') return null;
      const c = e.target.closest && e.target.closest('.fpf-cell[data-name]');
      if (!c || !frame.contains(c)) return null;
      e.preventDefault(); e.stopPropagation();
      return c;
    };
    frame.addEventListener('pointerdown', e => {
      const c = pickCell(e);
      if (!c || e.button > 0) return;
      press = { name: c.dataset.name, button: !!c.dataset.button, x: e.clientX, y: e.clientY, dragging: false, ghost: null, drop: null };
      const move = ev => {
        if (!press) return;
        if (!press.dragging && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < 6) return;
        if (!press.dragging) {
          press.dragging = true;
          press.ghost = el('div', 'ffe3-ghost', labelOf(press.name)[0]);
          document.body.appendChild(press.ghost);
          root.classList.add('dragging');
        }
        Object.assign(press.ghost.style, { left: (ev.clientX + 12) + 'px', top: (ev.clientY + 8) + 'px' });
        press.drop = dropAt(ev, press.name);
        showDrop(press.drop);
      };
      const up = () => {
        window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true);
        const p0 = press; press = null;
        root.classList.remove('dragging'); dropLine.hidden = true;
        if (!p0 || !p0.dragging) return;
        p0.ghost.remove();
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
        state.open = (p0.button ? 'b:' : 'f:') + p0.name;
        if (p0.drop) moveNear(p0.name, p0.drop.target, p0.drop.how); else markSelected();
      };
      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true);
    }, true);
    frame.addEventListener('click', e => {
      const c = pickCell(e);
      if (!c || suppressClick) return;
      focusRow((c.dataset.button ? 'b:' : 'f:') + c.dataset.name);
      markSelected();
    }, true);
    // The handle: drag the right edge; the size snaps to S, M, L or Full of its row's width.
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const name = state.open && state.open.slice(2);
      const c = name && frame.querySelector(`.fpf-cell[data-name="${window.CSS.escape(name)}"]`);
      if (!c) return;
      const rowEl = c.parentElement;
      const rr = rowEl.getBoundingClientRect(), cr = c.getBoundingClientRect();
      let n = (where(name) && widthOf(where(name).row, where(name).ci)) || 12;
      const snap = w => [3, 4, 6, 12].reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), 12);
      const move = ev => {
        n = snap(Math.max(1, Math.min(12, (ev.clientX - cr.left) / Math.max(1, rr.width) * 12)));
        selBox.style.width = (rr.width * n / 12 + 8) + 'px';
        selTag.textContent = `${labelOf(name)[0]} · ${({ 3: 'S', 4: 'M', 6: 'L', 12: 'Full' })[n]}`;
      };
      const up = () => { window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); setSize(name, n); };
      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true);
    });

    ctx.destroy = () => { if (inst) { inst.destroy(); inst = null; } if (ro) ro.disconnect(); };
    paintSub(); paintPane(); paintPreview();
    loadSamples().then(() => { if (root.isConnected && state.sample) paintPreview(); }).catch(() => {});
    loadScreens().then(() => { if (root.isConnected && screenNow()) paintPreview(); }).catch(() => {});
    // Opened from a file of its media on the map: that row, open.
    if (!subOf && ctx.media) { state.left = 'form'; state.open = 'md:' + ctx.media; ctx.media = null; setTimeout(() => { if (root.isConnected) { paintPane(); const r = pane.querySelector('.ffm-r.on, .ffm-props'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'center' }); } }, 0); }
    // Opened from a sub-form's row on the map: straight into it.
    if (!subOf && ctx.subform) {
      const sf = (Array.isArray(draft.subforms) ? draft.subforms : []).find(x => x && x.name === ctx.subform);
      ctx.subform = null;
      if (sf) setTimeout(() => { if (root.isConnected) editSubform(sf); }, 0);
    }
    return root;
  }

  /* ---------- A map editor: the outline on the left (rows that open their settings in place, each marked ✓ or ✗),
   * a live pane on the right, a divider between them. The structure and function editors are built on it. ---------- */
  function splitter(root) {
    const split = el('div', 'ffe-split');
    split.title = 'Drag to make the map wider or narrower (double-click to reset)';
    let mapw = null;
    try { mapw = Number(localStorage.getItem('ffe-mapw')) || null; } catch (_) { /* best effort */ }
    if (mapw) root.style.setProperty('--mapw', mapw + '%');
    split.onpointerdown = e => {
      e.preventDefault(); split.setPointerCapture(e.pointerId); split.classList.add('on');
      const r = root.getBoundingClientRect();
      const move = ev => { mapw = Math.max(22, Math.min(70, Math.round((ev.clientX - r.left) / r.width * 100))); root.style.setProperty('--mapw', mapw + '%'); };
      const up = () => { split.removeEventListener('pointermove', move); split.removeEventListener('pointerup', up); split.classList.remove('on'); try { localStorage.setItem('ffe-mapw', String(mapw)); } catch (_) { /* best effort */ } };
      split.addEventListener('pointermove', move); split.addEventListener('pointerup', up);
    };
    split.ondblclick = () => { mapw = null; root.style.removeProperty('--mapw'); try { localStorage.removeItem('ffe-mapw'); } catch (_) { /* best effort */ } };
    return split;
  }
  const shortProblem = x => x.replace(/^(Field|Button|Source|Read before starting|Container|Calculated|Status rule|Input|Session) [A-Za-z0-9_]+:\s*/, '')
    .replace(/^itemId:?\s*/, '').replace(/^./, c => c.toUpperCase());

  /* o: { stateKey, marked (RegExp of row keys that get a mark), problemKey(text) -> row key, top (the key problems
   *      fall to), build(api, box), right(prev, api), onOpen(key) } */
  /* A repaint asked for while the pointer is down in root (a name box's change fires as you click the next
   * row) waits until the click is done; if the click was on a list box, until you have picked from it.
   * Otherwise the row or list box you clicked is rebuilt under you and the click is lost. */
  function pointerSafe(root, fn) {
    let down = false, owed = null;
    const flush = () => { if (!owed) return; const a = owed; owed = null; a(); };
    const up = () => {
      down = false;
      if (!owed) return;
      setTimeout(() => {
        const f = document.activeElement;
        if (owed && f && f.tagName === 'SELECT' && root.contains(f)) {
          const go = () => { f.removeEventListener('change', go); f.removeEventListener('blur', go); setTimeout(flush, 0); };
          f.addEventListener('change', go); f.addEventListener('blur', go);
        } else flush();
      }, 0);
    };
    root.addEventListener('pointerdown', () => {
      down = true;
      window.addEventListener('pointerup', up, { capture: true, once: true });
      window.addEventListener('pointercancel', up, { capture: true, once: true });
    }, true);
    // A box's change also fires as you Tab (or a script moves) to the next box: wait while the focus stays in a box here.
    const typing = () => { const f = document.activeElement; return !!(f && root.contains(f) && f.matches('input:not([type=checkbox]):not([type=radio]),textarea,select')); };
    const waitForLeave = () => {
      const out = e => { if (e.relatedTarget && root.contains(e.relatedTarget) && e.relatedTarget.matches('input,textarea,select')) return; root.removeEventListener('focusout', out); setTimeout(() => { if (!down) flush(); }, 0); };
      root.addEventListener('focusout', out);
    };
    // Which box took the focus last, and when (a count): moved in after this change means Tab, not a script.
    let focusSeq = 0, focusEl = null;
    root.addEventListener('focusin', e => { focusSeq++; focusEl = e.target; });
    return function (...args) {
      if (down) { owed = () => fn.apply(this, args); return undefined; }
      const ev = window.event;
      if (ev && ev.type === 'change' && ev.target && root.contains(ev.target)) {
        owed = () => fn.apply(this, args);
        const at = focusSeq;
        setTimeout(() => {
          if (!owed || down) return;
          const moved = focusSeq > at && focusEl === document.activeElement && document.activeElement !== ev.target;
          if (moved && typing()) waitForLeave(); else flush();
        }, 0);
        return undefined;
      }
      owed = null;
      return fn.apply(this, args);
    };
  }

  function mapView(ctx, o) {
    injectCss();
    const state = ctx[o.stateKey] || (ctx[o.stateKey] = { open: null });
    const root = el('div', 'ffe');
    const left = el('div');
    const prev = el('div', 'ffe-prev');
    root.append(left, splitter(root), prev);
    const pane = el('div');
    left.appendChild(pane);
    const marks = new Map();
    let problems = ctx.problems || [];
    let reg = [];
    const tag = (t, color) => { const x = el('span', 'ffm-tag', t); if (color) x.style.background = color; return x; };
    function row(parent, r) {
      const d = el('div', 'ffm-r' + (r.cls ? ' ' + r.cls : '') + (state.open === r.key ? ' on' : ''));
      d.dataset.key = r.key;
      d.style.setProperty('--c', r.color || '#64748b');
      d.style.marginLeft = `${(r.depth || 0) * 14}px`;
      const t = el('b', 't'); const sub = el('span', 'd'); const extra = el('span', 'x');
      const body = el('span', 'body'); body.append(t, sub);
      const checked = o.marked.test(r.key);
      const mark = checked ? el('span', 'ffm-mark') : null;
      if (mark) d.appendChild(mark);
      d.append(body, extra);
      if (r.tools) r.tools.forEach(x => d.appendChild(x));
      const upd = () => { t.textContent = r.title(); sub.textContent = r.sub ? r.sub() : ''; extra.replaceChildren(...(r.tags ? r.tags() : [])); };
      upd(); reg.push(upd);
      d.onclick = e => { if (e.target.closest('button,input,select,label')) return; if (r.act) r.act(); else open(r.key); };
      parent.appendChild(d);
      if (checked) {
        const errs = el('div', 'ffm-errs');
        errs.style.marginLeft = `${(r.depth || 0) * 14 + 8}px`;
        parent.appendChild(errs);
        marks.set(r.key, { mark, errs, row: d });
      }
      if (state.open === r.key && r.props) {
        const p = el('div', 'ffm-props');
        p.style.marginLeft = `${(r.depth || 0) * 14 + 8}px`;
        r.props(p);
        parent.appendChild(p);
      }
      return d;
    }
    const head = (parent, text, help) => { const h = el('div', 'ffm-h'); h.append(el('b', null, text)); if (help) h.append(el('span', null, help)); parent.appendChild(h); };
    const addRow = (parent, key, text, depth, props, act) => row(parent, { key, cls: 'add', color: '#c9d0d9', depth, title: () => text, props, act });
    const mv = (list, i, dlt, after) => btn(dlt < 0 ? '↑' : '↓', 'mv', e => { e.stopPropagation(); const j = i + dlt; if (j < 0 || j >= list.length) return; list.splice(j, 0, list.splice(i, 1)[0]); after(); });
    function paintNow() {
      marks.clear(); reg = [];
      const box = el('div', 'ffm');
      o.build(api, box);
      pane.replaceChildren(box);
      paintMarks();
      if (o.onOpen) o.onOpen(state.open);
    }
    const paint = pointerSafe(root, paintNow);
    const soft = () => { reg.forEach(u => u()); paintMarks(); };
    function open(key) { state.open = state.open === key ? null : key; paint(); }
    function focus(key) {
      state.open = key; paint();
      const r = pane.querySelector(`.ffm-r[data-key="${window.CSS.escape(key)}"]`);
      if (r) r.scrollIntoView({ block: 'center' });
    }
    const byKey = () => { const out = new Map(); problems.forEach(t => { const k = o.problemKey(t); if (!out.has(k)) out.set(k, []); out.get(k).push(t); }); return out; };
    function paintMarks() {
      const by = byKey();
      // A problem whose row isn't on the map goes on the top row.
      by.forEach((list, k) => { if (k !== o.top && !marks.has(k)) { if (!by.has(o.top)) by.set(o.top, []); by.get(o.top).push(...list); by.delete(k); } });
      marks.forEach(({ mark, errs, row: d }, k) => {
        const mine = by.get(k) || [];
        mark.textContent = mine.length ? '✗' : '✓';
        mark.className = 'ffm-mark ' + (mine.length ? 'bad' : 'ok');
        mark.title = mine.length ? mine.join('\n') : 'Nothing to fix';
        d.classList.toggle('has-err', !!mine.length);
        errs.replaceChildren(...mine.map(x => el('div', null, '✗ ' + shortProblem(x))));
        errs.hidden = !mine.length;
      });
    }
    ctx.problemsChanged = list => { problems = list || []; paintMarks(); };
    ctx.goToProblem = () => { const by = byKey(); focus(Array.from(marks.keys()).find(x => by.has(x)) || o.top); };
    const api = { state, row, head, addRow, tag, mv, paint, soft, open, focus, prev, problems: () => problems };
    if (o.right) o.right(prev, api);
    paint();
    root.api = api;
    return root;
  }

  /* ---------- The structure editor: its ID, the values each item holds, status rules, who uses it;
   * the latest items on the right, worked out with what you are editing ---------- */
  const RULE_TEXT = { latest: 'keeps the latest', first: 'keeps the first', sum: 'adds them up', count: 'counts them', average: 'averages', min: 'keeps the lowest', max: 'keeps the highest', list: 'keeps a list' };
  const ITEM_SOURCES = [['$firstAt', 'when the item was first saved'], ['$lastAt', 'when it was last changed'], ['$asOf', 'now (or the time being reviewed)'], ['$entryCount', 'how many saves it has'], ['$lastAction', 'its last save\'s name']];
  const ITEM_FACTS = [['lastAction', 'the last save\'s name'], ['lastForm', 'the form that saved last'], ['firstAt', 'first saved'], ['lastAt', 'last changed'], ['entryCount', 'number of saves']];
  const VALUE_COLOR = { container: '#2a78d6', form: '#94a3b8', calculated: '#7c3aed', status: '#1a7f37', id: '#0e7490' };
  // A name renamed inside a formula (not inside quotes, not after a dot).
  const renameIn = (f, from, to) => String(f).split(/("(?:[^"\\]|\\.)*")/).map((part, i) => (i % 2 ? part : part.replace(new RegExp(`(?<![\\w.$])${from}(?![\\w])`, 'g'), to))).join('');

  function structureMap(draft, ctx) {
    draft.containers = draft.containers || {};
    const rules = FP.summary.rules;
    const changed = () => { ctx.changed(); paintItems(); };
    let sample = null, dataActions = [], api = null;
    const savers = () => {
      const m = new Map();
      FP.map.usedBy('structure', ctx.id).forEach(u => {
        const n = (u.how.match(/^saves (?:its value )?to (\w+)$/) || [])[1];
        if (n) { if (!m.has(n)) m.set(n, []); m.get(n).push(`${u.title} · ${u.field}`); }
      });
      return m;
    };
    const actionsInUse = () => Array.from(new Set(FP.defs.saveNames(ctx.id).concat(dataActions))).sort();
    const valueNames = withStatus => {
      const out = [], seen = new Set();
      const add = (n, k) => { if (!seen.has(n)) { seen.add(n); out.push([n, k]); } };
      Object.keys(draft.containers || {}).forEach(n => add(n, 'container'));
      Array.from(savers().keys()).forEach(n => add(n, (draft.calculated || {})[n] ? 'calculated' : 'from'));
      Object.keys(draft.calculated || {}).forEach(n => add(n, 'calculated'));
      ITEM_FACTS.forEach(([n]) => add(n, 'fact'));
      if (withStatus) add('status', 'status');
      return out;
    };
    const help = withStatus => ({ names: () => valueNames(withStatus), actions: actionsInUse });
    ctx.formulaHelp = help; ctx.actionsInUse = actionsInUse;
    if (FP.structures.has(ctx.id)) FP.current.load(ctx.id).then(r => {
      dataActions = Array.from(new Set((r.rows || []).map(e => String(e.entry).slice(String(e.entry).indexOf('.') + 1))));
      sample = Array.from(r.items.values()).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt))).slice(0, 12);
      paintItems(); if (api) api.soft();
    }).catch(() => { sample = []; paintItems(); });
    else sample = [];

    // The values, in order: what forms save to (in their order), what is only declared here, calculated values.
    const columns = () => {
      const calc = draft.calculated || {};
      const saved = savers();
      const cols = [];
      Array.from(saved.keys()).filter(n => !(n in calc) || n in draft.containers).concat(Object.keys(draft.containers).filter(n => !saved.has(n)))
        .forEach(n => cols.push({ kind: n in draft.containers ? 'container' : 'form', name: n }));
      Object.keys(calc).forEach(n => cols.push({ kind: 'calculated', name: n }));
      return cols;
    };
    const nameTaken = (n, except) => n !== except && (n in (draft.containers || {}) || n in (draft.calculated || {}) || n === 'id');
    const renameKey = (obj, from, to) => { const next = {}; Object.keys(obj).forEach(k => { next[k === from ? to : k] = obj[k]; }); return next; };
    // Renaming a value renames it where this structure names it: status rules, the open rule, calculated inputs, "taken from".
    function renameValue(from, to) {
      if (from in draft.containers) draft.containers = renameKey(draft.containers, from, to);
      if (draft.calculated && from in draft.calculated) draft.calculated = renameKey(draft.calculated, from, to);
      (draft.status || []).forEach(r => { if (r && r.when) r.when = renameIn(r.when, from, to); });
      if (draft.open) draft.open = renameIn(draft.open, from, to);
      Object.values(draft.calculated || {}).forEach(c => Object.keys((c && c.inputs) || {}).forEach(k => { if (c.inputs[k] === from) c.inputs[k] = to; }));
      if (api && api.state.open === 'v:' + from) api.state.open = 'v:' + to;
    }
    const set = (label, help2, node) => { const w = el('div', 'ffe-set'); const h = el('span', null, label + ' '); if (help2) h.appendChild(el('em', null, '· ' + help2)); w.append(h, node); return w; };
    const nameBox = (n, fixedWhy) => {
      if (fixedWhy) return set('Name', fixedWhy, el('b', null, n));
      const ni = input(n, { spellcheck: false }); const err = el('div', 'err');
      ni.onchange = () => {
        const to = ni.value.trim();
        if (to === n) return;
        if (!NAME_RE.test(to)) { err.textContent = 'Letters, digits and _, starting with a letter.'; return; }
        if (nameTaken(to, n)) { err.textContent = 'Already a value here.'; return; }
        renameValue(n, to); changed(); api.paint();
      };
      const w = set('Name', 'what forms and formulas call it', ni); w.appendChild(err); return w;
    };

    /* Settings of the structure itself. */
    function topProps(box) {
      const li = input(draft.label || '', { placeholder: ctx.id });
      li.oninput = () => { if (li.value.trim()) draft.label = li.value.trim(); else delete draft.label; ctx.changed(); api.soft(); };
      box.appendChild(set('Label', `what people see; its name in the library, ${ctx.id}, never changes`, li));
      const sl = el('div', 'ffe-set'); sl.appendChild(el('span', null, 'Used at'));
      box.appendChild(sl);
      if (FP.editor.ui.sitesPicker) FP.editor.ui.sitesPicker(draft, () => { ctx.changed(); api.soft(); }).then(n => sl.appendChild(n)).catch(() => {});
      // Loading
      if (draft.kind) {
        const ks = select(FP.kinds.list().map(k => [k.name, k.label]), draft.kind);
        ks.onchange = () => setKind(ks.value);
        const kw = set('Kind', FP.kinds.get(draft.kind).help, ks); kw.classList.add('ffe-kind'); box.appendChild(kw);
      }
      const lg = el('div', 'ffe-group');
      const di = input(draft.live && draft.live.days || '', { type: 'number', min: 1, max: 3650, placeholder: 'everything' });
      di.oninput = () => { const n = Number(di.value); if (di.value && Number.isInteger(n) && n >= 1) draft.live = { days: n }; else delete draft.live; ctx.changed(); api.soft(); };
      lg.appendChild(set('Live window (days)', 'for busy structures: load only recent items, plus any still open', di));
      if (!draft.kind) lg.appendChild(set('Still open while', 'items this is true for stay loaded however old', formulaInput(draft.open || '', v => { if (v) draft.open = v; else delete draft.open; ctx.changed(); }, 'e.g. status <> "Shipped"', help(true))));
      const pf = FP.defs.perf(ctx.id);
      if (pf && pf.status === 'slow') lg.appendChild(el('div', 'fpe-note', pf.message));
      box.appendChild(set('Loading', 'leave both empty to load everything', lg));
      // Sessions are gone (0.36); a structure from before that still names them says so, and can drop them.
      if (draft.sessions && Object.keys(draft.sessions).length) {
        const g = el('div', 'fpe-note', `This structure still names sessions: ${Object.entries(draft.sessions).map(([t, raw]) => `${t} (${raw && typeof raw === 'object' ? raw.mode : raw})`).join(', ')}. Sessions are gone (0.36), so nothing records them now, and it can't be published until they are taken out. A run is an item of a Runs structure whose status is Running (forms find it with "Found by a rule"); a shift is a calculated value worked out from when a save happened (Admin > Clean-up can make it from the old time table). Saved entries keep their session references.`);
        g.appendChild(el('br')); g.appendChild(btn('Take the sessions out', 'small', () => { delete draft.sessions; ctx.changed(); api.paint(); }));
        box.appendChild(g);
      }
    }

    /* The ID: what it's called and how it's made. */
    function idProps(box) {
      const t = draft.itemId || {};
      const modes = FP.defs.idModes(ctx.id).filter(m => m.mode !== 'found');
      const setId = patch => { draft.itemId = Object.assign({}, draft.itemId || {}, patch); Object.keys(draft.itemId).forEach(k => { if (draft.itemId[k] == null || draft.itemId[k] === '') delete draft.itemId[k]; }); if (draft.itemId.made !== 'new') delete draft.itemId.prefix; if (!Object.keys(draft.itemId).length) delete draft.itemId; ctx.changed(); paintItems(); };
      const li = input(t.label || '', { placeholder: 'ID', spellcheck: false });
      li.oninput = () => { setId({ label: li.value.trim() }); api.soft(); };
      const lw = set('What it is called', 'e.g. Delivery no.; forms, pickers and printouts use it', li);
      const fl = modes.find(m => m.mode === 'entered' && m.fieldLabel);
      if (fl && !t.label) lw.appendChild(btn(`Call it “${fl.fieldLabel}”`, 'small', () => { setId({ label: fl.fieldLabel }); api.paint(); }));
      box.appendChild(lw);
      const fixedBy = draft.kind && FP.kinds.get(draft.kind).id;
      const ms = select(fixedBy ? [[fixedBy, fixedBy === 'new' ? 'made new each save (Records)' : 'entered on the form (a List)']] : [['', 'not set: forms decide'], ['entered', 'entered on the form (typed or scanned)'], ['new', 'made new each save']], fixedBy || t.made || '');
      if (fixedBy) ms.disabled = true;
      ms.onchange = () => { setId({ made: ms.value }); api.paint(); };
      box.appendChild(set('How it is made', null, ms));
      if (t.made === 'new') {
        const pi = input(t.prefix || '', { placeholder: 'e.g. DEL', spellcheck: false }); pi.style.textTransform = 'uppercase';
        pi.oninput = () => { setId({ prefix: pi.value.trim().toUpperCase() }); api.soft(); };
        box.appendChild(set('Prefix', `IDs look like ${(t.prefix || 'XX')}-T01-20261112-…`, pi));
      } else if (t.made === 'entered') box.appendChild(el('p', 'ffe-note', 'Every form that adds items needs a field for it.'));
      const g = el('div', 'ffe-group');
      modes.forEach(m => g.appendChild(el('div', 'fpe-hint', m.mode === 'entered' ? `entered in ${m.title} · ${m.fieldLabel}` : `made new each save in ${m.title}`)));
      const kinds = new Set(modes.map(m => m.mode));
      if (!t.made && kinds.size > 1) g.appendChild(el('div', 'fpe-warn', 'Forms disagree: some enter the ID and some make a new one, so one item can end up as two. Choose one above.'));
      else if (!t.made && kinds.size === 1) { const k = Array.from(kinds)[0]; g.appendChild(btn(`Set to ${k === 'new' ? 'made new each save' : 'entered'}`, 'small', () => { setId({ made: k }); api.paint(); })); }
      if (!modes.length) g.appendChild(el('div', 'fpe-hint', 'No forms add items yet.'));
      box.appendChild(set('Forms', 'how they give it', g));
    }

    /* One value: a container (saved by forms) or a calculated one (worked out by a function). */
    function valueProps(col, box) {
      const n = col.name;
      const saved = savers();
      if (col.kind === 'calculated') {
        const c = draft.calculated[n];
        box.appendChild(nameBox(n));
        const fs = select([['', 'choose a function…']].concat(FP.fn.list().map(f => [f.name, `${f.name}${f.label && f.label !== f.name ? ' — ' + f.label : ''}`])), c.fn || '');
        fs.onchange = () => { draft.calculated[n] = { fn: fs.value, inputs: {} }; changed(); api.paint(); };
        box.appendChild(set('Worked out by', 'a function from the library; worked out each time an item is read, never saved', fs));
        const f = FP.fn.get(c.fn);
        if (f && (f.inputs || []).length) {
          const g = el('div', 'ffe-group');
          const names = Object.keys(draft.containers).concat(Array.from(saved.keys()).filter(k => !(k in draft.containers))).filter(k => k !== n);
          f.inputs.forEach(inp => {
            const sv = select([['', '—']].concat(names.map(k => [k, k]), ITEM_SOURCES), (c.inputs || {})[inp.name] || '');
            sv.onchange = () => { const cur = Object.assign({}, draft.calculated[n].inputs); if (sv.value) cur[inp.name] = sv.value; else delete cur[inp.name]; draft.calculated[n].inputs = cur; changed(); api.soft(); };
            g.appendChild(set(`${inp.name}${inp.required === false ? '' : ' *'}`, inp.type && inp.type !== 'any' ? inp.type : null, sv));
          });
          box.appendChild(set('Its inputs', 'from this item', g));
        }
        if (ctx.open && c.fn && f) box.appendChild(btn(`Edit ${c.fn} ›`, 'small', () => ctx.open('function', c.fn)));
        box.appendChild(btn('Remove this value', 'small', () => { delete draft.calculated[n]; api.state.open = null; changed(); api.paint(); }));
        return;
      }
      const declared = col.kind === 'container';
      box.appendChild(nameBox(n, saved.has(n) || !declared ? 'forms save to it by this name; rename it in the forms first' : null));
      const c = draft.containers[n] || {};
      const keep = cur => { draft.containers[n] = cur; changed(); api.soft(); };
      const rs = select(rules.map(r => [r, RULE_TEXT[r] || r]), c.rule || 'latest');
      rs.onchange = () => { const cur = Object.assign({}, draft.containers[n] || {}); if (rs.value === 'latest') delete cur.rule; else cur.rule = rs.value; keep(cur); };
      box.appendChild(set('When saved more than once', 'what the item keeps', rs));
      const fi = input(c.from || '', { placeholder: n, spellcheck: false });
      fi.onchange = () => { const v = fi.value.trim(); const cur = Object.assign({}, draft.containers[n] || {}); if (v) cur.from = v; else delete cur.from; keep(cur); };
      box.appendChild(set('Taken from', 'optional: a differently named value of the save', fi));
      const g = el('div', 'ffe-group');
      (saved.get(n) || []).forEach(x => g.appendChild(el('div', 'fpe-hint', x)));
      if (!saved.has(n)) g.appendChild(el('div', 'fpe-hint', 'No forms save to it yet.'));
      box.appendChild(set('Saved by', null, g));
      if (!declared) box.appendChild(el('p', 'ffe-note', 'Forms save to it, so it is a value of this structure whether or not it is listed here. Change how it keeps saves above and it is listed.'));
      else if (!saved.has(n)) box.appendChild(btn('Remove this value', 'small', () => { delete draft.containers[n]; api.state.open = null; changed(); api.paint(); }));
    }

    function addValueProps(box) {
      const ni = input('', { placeholder: 'e.g. qty', spellcheck: false });
      const err = el('div', 'err');
      const add = kind => {
        const n = ni.value.trim();
        if (!NAME_RE.test(n)) { err.textContent = 'Letters, digits and _, starting with a letter.'; return; }
        if (nameTaken(n)) { err.textContent = 'Already a value of this structure.'; return; }
        if (kind === 'calculated' && savers().has(n)) { err.textContent = `Forms save to ${n}; a calculated value can't have that name.`; return; }
        if (kind === 'container') draft.containers[n] = {}; else { draft.calculated = draft.calculated || {}; draft.calculated[n] = { fn: '', inputs: {} }; }
        api.state.open = 'v:' + n; changed(); api.paint();
        if (kind === 'container' && ctx.onContainerAdded) ctx.onContainerAdded(n);
      };
      ni.onkeydown = e => { if (e.key === 'Enter') add('container'); };
      box.appendChild(set('Name', 'letters, digits and _', ni));
      const r = el('div', 'fpe-row');
      r.append(btn('Add a value forms save to', 'small', () => add('container')), btn('Add a calculated value', 'small', () => add('calculated')));
      box.append(r, err);
    }

    function statusProps(i, box) {
      const r = draft.status[i];
      const vi = input(r.value || '', { placeholder: 'e.g. Received' });
      vi.oninput = () => { draft.status[i] = Object.assign({}, draft.status[i], { value: vi.value }); changed(); api.soft(); };
      box.appendChild(set('Status', 'the label items get', vi));
      box.appendChild(set('When', 'TRUE for every item the rules above leave', formulaInput(r.when || '', v => { draft.status[i] = Object.assign({}, draft.status[i], { when: v }); changed(); api.soft(); }, 'e.g. receivedQty >= expectedQty', help(false))));
      box.appendChild(btn('Remove this rule', 'small', () => { draft.status.splice(i, 1); api.state.open = null; changed(); api.paint(); }));
    }

    /* The kinds, each with what it is for: picking one sets it (0.59). */
    function kindPicker() {
      const w = el('div', 'ffe-kinds');
      w.appendChild(el('b', null, 'What kind of structure is this?'));
      w.appendChild(el('div', 'fpe-hint', 'The kind brings its status, when an item is open, and how its IDs are made.'));
      const g = el('div', 'ffe-pick');
      FP.kinds.list().forEach(k => {
        const b = btn('', null, () => { setKind(k.name); });
        b.dataset.kind = k.name;
        b.append(document.createTextNode(k.label), el('small', null, k.help));
        g.appendChild(b);
      });
      w.appendChild(g);
      return w;
    }
    function setKind(k) {
      draft.kind = k;
      const K = FP.kinds.get(k);
      if (K.id) draft.itemId = Object.assign({}, draft.itemId || {}, { made: K.id });
      delete draft.open;
      draft.roles = {};
      // A value already named like a role plays it (endAt for ended, made for done…).
      const guess = { ended: ['endAt', 'endedAt', 'ended'], started: ['startAt', 'startedAt', 'started'], wanted: ['wanted', 'racks', 'qty', 'quantity'], done: ['done', 'made'], cancelled: ['cancelled'], due: ['due', 'dueAt'],
        active: ['active'], quantity: ['quantity', 'qty', 'pieces'], place: ['place', 'location'], madeFrom: ['madeFrom', 'fromRun', 'run'], hold: ['hold', 'onHold'], gone: ['gone', 'shippedAt', 'usedAt'], closed: ['closed', 'closedAt'], acknowledged: ['acknowledged', 'acknowledgedAt'], owner: ['owner'] };
      K.roles.forEach(r => { const n = (guess[r.name] || []).find(x => Object.prototype.hasOwnProperty.call(draft.containers || {}, x)); if (n) draft.roles[r.name] = n; });
      if (K.statusFixed) draft.status = [];
      changed(); if (api) api.paint();
    }
    function roleProps(r, box) {
      box.appendChild(el('p', 'ffe-note', r.help ? `${r.label}: ${r.help}.` : `${r.label}.`));
      const names = Object.keys(draft.containers || {});
      const sel = select([['', r.required ? 'choose a value' : 'not used']].concat(names.map(n => [n, n])), (draft.roles || {})[r.name] || '');
      sel.onchange = () => { draft.roles = draft.roles || {}; if (sel.value) draft.roles[r.name] = sel.value; else delete draft.roles[r.name]; changed(); api.paint(); };
      box.appendChild(set('The value', `one of this structure's values${r.rules ? '; it must add up or count what forms save' : ''}`, sel));
      if (!names.length) box.appendChild(el('div', 'fpe-hint', 'Add the value under Values first (+ value).'));
    }

    function build(a, box) {
      api = a;
      const { row, head, addRow, tag, mv } = a;
      const doc = FP.defs.get('structure', ctx.id);
      const K = draft.kind ? FP.kinds.get(draft.kind) : null;
      row(box, { key: 'top', color: '#0e7490', cls: 'top', title: () => draft.label || ctx.id,
        sub: () => [K ? K.label : 'no kind yet', `structure ${ctx.id}`, doc ? `v${doc.version}` : 'new', (draft.sites || []).join(', '), draft.live ? `last ${draft.live.days} days` : null].filter(Boolean).join(' · '), props: topProps });
      // The kind (0.59): picked first; it brings the status, the open rule and the ID rule.
      // Without a kind (new, or from before 0.59) the kinds come first; the rest shows under them as it was.
      if (!K) box.appendChild(kindPicker());
      if (K && K.roles.length) {
        head(box, `What plays each part`, `a ${K.label.replace(/s$/, '').toLowerCase()} needs these`);
        draft.roles = draft.roles && typeof draft.roles === 'object' ? draft.roles : {};
        K.roles.forEach(r => {
          row(box, { key: 'role:' + r.name, depth: 1, color: draft.roles[r.name] ? '#0b7a75' : r.required ? '#e5484d' : '#c9d0d9', cls: 'val' + (r.required && !draft.roles[r.name] ? ' idrow unset' : ''),
            title: () => r.label + (r.required ? ' *' : ''), sub: () => (draft.roles[r.name] ? `is ${draft.roles[r.name]}` : r.required ? 'say which value' : 'not used'),
            props: p => roleProps(r, p) });
        });
      }

      head(box, 'The ID', 'names each item');
      const t = draft.itemId || {};
      row(box, { key: 'id', depth: 1, color: VALUE_COLOR.id, cls: 'val idrow' + (t.made ? '' : ' unset'), title: () => (draft.itemId && draft.itemId.label) || 'ID',
        sub: () => { const x = draft.itemId || {}; return x.made === 'new' ? `made new each save${x.prefix ? ` (${x.prefix}-…)` : ''}` : x.made === 'entered' ? 'entered on the form' : 'not set: forms decide'; },
        tags: () => [tag('ID', '#fde9c8')], props: idProps });

      head(box, 'Values', 'what each item holds');
      const saved = savers();
      columns().forEach(col => {
        const n = col.name;
        row(box, { key: 'v:' + n, depth: 1, color: VALUE_COLOR[col.kind], cls: 'val',
          title: () => n,
          sub: () => {
            if (col.kind === 'calculated') { const c = (draft.calculated || {})[n] || {}; return c.fn ? `= ${c.fn}(${Object.entries(c.inputs || {}).map(([k, v]) => `${k}: ${v}`).join(', ')})` : 'choose a function'; }
            const c = draft.containers[n] || {};
            const by = (saved.get(n) || []).map(x => `← ${x}`);
            return [RULE_TEXT[c.rule || 'latest'], c.from ? `from ${c.from}` : null].concat(by.length ? by : ['no forms save to it yet']).filter(Boolean).join(' · ');
          },
          tags: () => [tag(col.kind === 'calculated' ? 'calculated' : col.kind === 'form' ? 'from forms' : 'saved')],
          props: p => valueProps(col, p) });
      });
      row(box, { key: 'facts', depth: 1, color: '#d6dbe1', cls: 'kid', title: () => 'On every item', sub: () => ITEM_FACTS.map(([f]) => f).join(' · '), act: () => {} });
      addRow(box, '+v', '+ value', 1, addValueProps);

      const KS = K || { statusFree: true, label: 'Items' };
      head(box, 'Status', KS.statusFree ? 'checked from the top; the first rule that is true names the item' : `${K.plural || K.label} give themselves ${FP.kinds.builtWords(draft.kind, draft.roles || {}).join(', ')}${K.statusFixed ? '' : '; add others while an item is open'}`);
      draft.status = draft.status || [];
      if (!KS.statusFree) {
        const built = FP.kinds.statusRules(draft).filter(r => r.built);
        const lastB = built.length && K.last ? built[built.length - 1] : null;
        built.filter(r => r !== lastB).forEach((r, i) => row(box, { key: 'stb:' + i, depth: 1, color: '#9ccfb0', cls: 'kid', title: () => r.value, sub: () => `when ${r.when} · the kind's`, act: () => {} }));
        if (lastB) row(box, { key: 'stb:last', depth: 1, color: '#9ccfb0', cls: 'kid', title: () => lastB.value, sub: () => (draft.status.length ? 'otherwise · the kind\'s' : 'every other item · the kind\'s'), act: () => {} });
      }
      if (!KS.statusFixed) draft.status.forEach((r, i) => {
        row(box, { key: 'st:' + i, depth: 1, color: VALUE_COLOR.status, title: () => (draft.status[i] && draft.status[i].value) || '(no label)',
          sub: () => `when ${(draft.status[i] && draft.status[i].when) || '?'}`, tools: [mv(draft.status, i, -1, () => { changed(); a.paint(); }), mv(draft.status, i, 1, () => { changed(); a.paint(); })],
          props: p => statusProps(i, p) });
      });
      if (!KS.statusFixed) addRow(box, '+st', KS.statusFree ? '+ status rule' : '+ status while open', 1, null, () => { draft.status.push({ value: '', when: KS.statusFree && draft.status.length ? 'TRUE' : '' }); a.state.open = 'st:' + (draft.status.length - 1); changed(); a.paint(); });

      // Who uses it: forms that save to it or read it, lookups that read it.
      const users = new Map();
      FP.map.usedBy('structure', ctx.id).forEach(u => { const k = u.form ? 'form:' + u.form : u.title; if (!users.has(k)) users.set(k, { u, hows: [] }); users.get(k).hows.push(u.field ? `${u.field} ${u.how}` : u.how); });
      head(box, 'Used by', users.size ? null : 'nothing yet');
      users.forEach(({ u, hows }, k) => {
        const fn = !u.form && /^function (\w+)/.exec(u.title);
        const go = u.form ? () => ctx.open('form', u.form) : fn ? () => ctx.open('function', fn[1]) : null;
        row(box, { key: 'u:' + k, depth: 1, color: u.form ? '#2a78d6' : '#7c3aed', cls: 'kid', title: () => u.title, sub: () => hows.join(' · '),
          tools: ctx.open && go ? [btn('Edit ›', 'small', e => { e.stopPropagation(); go(); })] : [], act: () => {} });
      });
    }

    /* Right: the latest items, with the calculations and status rules as they stand in the editor. */
    let itemsBox = null, ihead = null;
    function itemValues(it) {
      const values = Object.assign({}, it.values || {});
      const asOf = new Date();
      const srcVal = src => src === '$firstAt' ? it.firstAt : src === '$lastAt' ? it.lastAt : src === '$asOf' ? asOf.toISOString() : src === '$entryCount' ? it.entryCount : src === '$lastAction' ? it.lastAction : src === '$lastForm' ? it.lastForm : values[src] === undefined ? null : values[src];
      Object.entries(draft.calculated || {}).forEach(([n, c]) => {
        if (!c || !c.fn || !FP.fn.get(c.fn)) { values[n] = null; return; }
        const args = {};
        Object.entries(c.inputs || {}).forEach(([k, src]) => { args[k] = srcVal(src); });
        try { values[n] = FP.fn.call(c.fn, args, { asOf }); } catch (e) { values[n] = { __fp: 'error', message: e.message }; }
      });
      const facts = Object.assign({}, values, { lastAction: it.lastAction, lastForm: it.lastForm, firstAt: it.firstAt, lastAt: it.lastAt, entryCount: it.entryCount });
      let status = null;
      for (const r of (draft.kind ? FP.kinds.expand(draft).status : draft.status) || []) {
        if (!r || !r.when) continue;
        let ok = false;
        try { ok = FP.fn.evaluate(r.when, facts, { asOf }) === true; } catch (_) { ok = false; }
        if (ok) { status = r.value; break; }
      }
      return { values, status };
    }
    const show = v => v == null || v === '' ? '' : Array.isArray(v) ? v.map(show).join(', ') : typeof v === 'object' ? (v.__fp ? (v.__fp === 'error' ? '⚠' : '') : JSON.stringify(v)) : String(v);
    function paintItems() {
      if (!itemsBox) return;
      const open = api && api.state.open;
      const cols = [{ kind: 'id', name: 'id', key: 'id', label: (draft.itemId && draft.itemId.label) || 'ID' }]
        .concat(columns().map(c => Object.assign({ key: 'v:' + c.name, label: c.name }, c)))
        .concat((draft.kind ? FP.kinds.expand(draft).status : draft.status || []).length ? [{ kind: 'status', name: 'status', key: 'st', label: 'status' }] : []);
      itemsBox.replaceChildren();
      if (sample == null) { itemsBox.appendChild(el('p', 'ffe-note', 'Loading…')); return; }
      if (!sample.length) { itemsBox.appendChild(el('p', 'ffe-note', FP.structures.has(ctx.id) ? 'No items yet. Once forms save to it, the latest show here, worked out with what you are editing.' : 'Once it is published and forms save to it, its latest items show here.')); }
      const wrap = el('div', 'fsm-wrap');
      const tbl = el('table', 'fsm-items');
      const hr = el('tr');
      cols.forEach(c => {
        const th = el('th', 'k-' + c.kind + (open && (open === c.key || (c.key === 'st' && /^st:/.test(open))) ? ' sel' : ''), c.label);
        th.style.borderTopColor = VALUE_COLOR[c.kind === 'form' ? 'form' : c.kind] || '#64748b';
        th.title = c.kind === 'calculated' ? 'Worked out with the function as set here' : c.kind === 'status' ? 'From the status rules as set here' : '';
        th.onclick = () => { if (api) api.focus(c.key === 'st' ? ((draft.status || []).length ? 'st:0' : '+st') : c.key); };
        hr.appendChild(th);
      });
      tbl.appendChild(hr);
      const counts = new Map();
      sample.forEach(it => {
        const w = itemValues(it);
        counts.set(w.status || '(none)', (counts.get(w.status || '(none)') || 0) + 1);
        const tr = el('tr');
        cols.forEach(c => {
          const v = c.kind === 'id' ? it.id : c.kind === 'status' ? w.status : w.values[c.name];
          const td = el('td', 'k-' + c.kind + (open && (open === c.key || (c.key === 'st' && /^st:/.test(open))) ? ' sel' : ''), show(v));
          if (v && v.__fp === 'error') td.title = v.message;
          tr.appendChild(td);
        });
        tbl.appendChild(tr);
      });
      wrap.appendChild(tbl);
      if (sample.length) itemsBox.appendChild(wrap);
      if (sample.length && (draft.kind ? FP.kinds.expand(draft).status : draft.status || []).length) itemsBox.appendChild(el('p', 'ffe-note', 'Status of these: ' + Array.from(counts.entries()).map(([k, n]) => `${k} ${n}`).join(' · ')));
      ihead.textContent = sample.length ? `Latest ${sample.length} items · calculations and status as set here` : 'Items';
    }
    return mapView(ctx, {
      stateKey: 'structState', top: 'top', marked: /^(top$|id$|v:|st:|role:)/,
      problemKey(t) {
        let m;
        // A kind's roles (0.59): "Say which value is when it ended", "When it ended: x is not a value…"
        const K = draft.kind && FP.kinds.get(draft.kind);
        if (K) { const r = K.roles.find(x => t.startsWith(`Say which value is ${x.label.toLowerCase()}`) || t.startsWith(x.label + ':')); if (r) return 'role:' + r.name; }
        if (/Records make a new ID|IDs are typed in/.test(t)) return 'id';
        if (/^itemId|IDs are|enters the ID|makes a new ID/.test(t)) return 'id';
        if ((m = /^(?:Container|Calculated) ([A-Za-z0-9_]+):/.exec(t))) return 'v:' + m[1];
        if ((m = /^([A-Za-z0-9_]+) is both a container/.exec(t))) return 'v:' + m[1];
        if ((m = /saves to ([A-Za-z0-9_]+), which would be/.exec(t))) return 'v:' + m[1];
        if ((m = /^Status rule (\d+)/.exec(t))) return 'st:' + (Number(m[1]) - 1);
        if (/^status is the name/.test(t)) return 'v:status';
        return 'top';
      },
      build,
      right(prev) {
        ihead = el('span', null, 'Items');
        const h = el('header'); h.appendChild(ihead);
        itemsBox = el('div', 'fsm-body');
        prev.append(h, itemsBox);
        paintItems();
      },
      onOpen: () => paintItems(),
    });
  }

  /* ---------- The function editor: inputs, then a formula or what it reads; tried out on the right ---------- */
  const TYPES = ['text', 'number', 'date', 'boolean', 'list', 'record', 'item', 'any'];
  const SUMMARY_TEXT = { latest: 'the latest match', first: 'the first match', count: 'how many match', list: 'every match, as a list', sum: 'the matches added up', average: 'the average of the matches', min: 'the smallest match', max: 'the largest match' };
  const WINDOW_TEXT = { form: 'recent data (what the structure keeps loaded)', all: 'everything', 'always-current': 'always today\'s data' };
  function functionEditor(draft, ctx) {
    draft.inputs = Array.isArray(draft.inputs) ? draft.inputs : [];
    const isLookup = () => draft.kind === 'lookup';
    let api = null;
    const changed = () => { ctx.changed(); schedule(); };
    const sampled = {};
    function containersOf(st) {
      const out = new Map();
      const d = FP.defs.get('structure', st);
      const def = d ? d.def : FP.structures.get(st);
      Object.keys((def && def.containers) || {}).forEach(n => out.set(n, 'container'));
      FP.map.usedBy('structure', st).forEach(u => { const m = /^saves (?:its value )?to (\w+)$/.exec(u.how || ''); if (m && !out.has(m[1])) out.set(m[1], 'container'); });
      if (!sampled[st]) { sampled[st] = new Set(); FP.current.load(st).then(r => { Array.from(r.items.values()).slice(-30).forEach(it => Object.keys(FP.current.publicValues(st, it.values || {})).forEach(k => sampled[st].add(k))); if (api) api.paint(); }).catch(() => {}); }
      sampled[st].forEach(n => { if (!out.has(n)) out.set(n, 'container'); });
      Object.keys((def && def.calculated) || {}).forEach(n => out.set(n, 'calculated'));
      return Array.from(out.keys());
    }
    // A lookup's output follows from what it returns; the editor keeps it in step.
    const syncOutput = () => {
      if (!isLookup()) return;
      const r = draft.reads || {};
      const single = typeof r.return === 'string' && r.return !== '*';
      draft.output = r.summary === 'count' ? 'number' : r.summary === 'list' ? 'list' : single ? 'any' : 'record';
    };
    const set = (label, help, node) => { const w = el('div', 'ffe-set'); const h = el('span', null, label + ' '); if (help) h.appendChild(el('em', null, '· ' + help)); w.append(h, node); return w; };
    const stLabel = st => { const d = FP.defs.get('structure', st); return st ? ((d && d.def.label) || st) : 'choose a structure'; };
    const gives = () => draft.output === 'number' ? 'a number' : draft.output === 'list' ? 'a list' : draft.output === 'record' ? 'a record' : draft.output === 'boolean' ? 'true or false' : draft.output && draft.output !== 'any' ? draft.output : 'a value';

    function topProps(box) {
      const li = input(draft.label || '', { placeholder: ctx.id });
      li.oninput = () => { if (li.value.trim()) draft.label = li.value.trim(); else delete draft.label; ctx.changed(); api.soft(); };
      box.appendChild(set('Label', 'what people see in pickers', li));
      const ks = select([['formula', 'Works out a value from its inputs'], ['lookup', 'Reads a structure (a lookup)']], isLookup() ? 'lookup' : 'formula');
      ks.onchange = () => {
        if (ks.value === 'lookup') { draft.kind = 'lookup'; delete draft.formula; draft.reads = draft.reads || { structure: '', from: 'items', return: '*', summary: 'latest' }; syncOutput(); }
        else { delete draft.kind; delete draft.reads; draft.formula = draft.formula || ''; draft.output = 'any'; }
        changed(); api.paint();
      };
      box.appendChild(set('What it does', null, ks));
      const sl = el('div', 'ffe-set'); sl.appendChild(el('span', null, 'Used at'));
      box.appendChild(sl);
      if (FP.editor.ui.sitesPicker) FP.editor.ui.sitesPicker(draft, () => { ctx.changed(); api.soft(); }).then(n => sl.appendChild(n)).catch(() => {});
    }
    function inputProps(i, box) {
      const inp = draft.inputs[i];
      const ni = input(inp.name || '', { spellcheck: false }); const err = el('div', 'err');
      ni.onchange = () => {
        const to = ni.value.trim(), from = inp.name;
        if (to === from) return;
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(to)) { err.textContent = 'Letters, digits and _.'; return; }
        if (draft.inputs.some(x => x !== inp && x.name === to)) { err.textContent = 'Already an input.'; return; }
        inp.name = to;
        if (draft.formula) draft.formula = renameIn(draft.formula, from, to);
        if (draft.reads && draft.reads.match) Object.keys(draft.reads.match).forEach(k => { if (draft.reads.match[k] === from) draft.reads.match[k] = to; });
        if (tries[from] != null) { tries[to] = tries[from]; delete tries[from]; }
        changed(); api.paint();
      };
      const nw = set('Name', 'what the formula calls it; renaming renames it there too', ni); nw.appendChild(err);
      box.appendChild(nw);
      const ts = select(TYPES.map(t => [t, t]), inp.type || 'any');
      ts.onchange = () => { inp.type = ts.value; changed(); api.soft(); };
      box.appendChild(set('Kind of value', null, ts));
      const rq = el('label', 'ffe-check'); const rc = input('', { type: 'checkbox' }); rc.checked = inp.required !== false;
      rc.onchange = () => { if (rc.checked) delete inp.required; else inp.required = false; changed(); api.soft(); };
      rq.append(rc, document.createTextNode('Needed: until it has a value, the function waits'));
      box.appendChild(rq);
      box.appendChild(btn('Remove this input', 'small', () => { draft.inputs.splice(i, 1); api.state.open = null; changed(); api.paint(); }));
    }
    function formulaProps(box) {
      const help = { names: () => draft.inputs.map(x => [x.name, 'container']), unknown: 'not an input of this function' };
      box.appendChild(set('Formula', 'uses the inputs by name', formulaInput(draft.formula || '', v => { draft.formula = v; changed(); api.soft(); }, 'e.g. ROUND(bad / (good + bad) * 100, 1)', help)));
      const os = select(TYPES.map(t => [t, t]), draft.output || 'any');
      os.onchange = () => { draft.output = os.value; changed(); api.soft(); };
      box.appendChild(set('It gives', 'checked against what the formula gives', os));
    }
    function readsProps(box) {
      const r = draft.reads = draft.reads || {};
      const own = FP.defs.list('structure').filter(d => !d.retired).map(d => [d.id, `${(d.def && d.def.label) || d.id} (${d.id})`]);
      const ss = select([['', 'choose a structure…']].concat(own, [['users', 'Users (built in)'], ['sites', 'Sites (built in)']]), r.structure || '');
      ss.onchange = () => { r.structure = ss.value; r.match = {}; r.return = '*'; syncOutput(); changed(); api.paint(); };
      box.appendChild(set('Structure', null, ss));
      if (!r.structure) return;
      const fs = select([['items', 'its items as they are now'], ['entries', 'every save to it (history)']], r.from || 'items');
      fs.onchange = () => { r.from = fs.value; if (fs.value === 'items' && !['latest', 'first', 'count', 'list'].includes(r.summary)) r.summary = 'latest'; if (fs.value === 'items') delete r.action; syncOutput(); changed(); api.paint(); };
      box.appendChild(set('Reads', null, fs));
      if (r.from === 'entries') {
        const names = FP.defs.saveNames(r.structure);
        const ai = input(r.action || '', { placeholder: 'any save', spellcheck: false });
        ai.oninput = () => { if (ai.value.trim()) r.action = ai.value.trim(); else delete r.action; changed(); api.soft(); };
        const w = el('div'); w.appendChild(ai);
        if (names.length) w.appendChild(chips(names.map(a => [a, 'action' + (r.action === a ? ' on' : '')]), a => { r.action = r.action === a ? undefined : a; if (!r.action) delete r.action; changed(); api.paint(); }));
        box.appendChild(set('Only saves named', 'optional', w));
      }
      if (ctx.open && FP.defs.get('structure', r.structure)) box.appendChild(btn(`Edit ${stLabel(r.structure)} ›`, 'small', () => ctx.open('structure', r.structure)));
    }
    const keysOf = r => containersOf(r.structure).concat(['$id', '$site']);
    const keyText = k => (k === '$id' ? 'its ID' : k === '$site' ? 'its site' : k);
    function matchProps(k, box) {
      const r = draft.reads;
      const v = r.match[k];
      const keys = keysOf(r);
      const kSel = select(keys.concat(keys.includes(k) ? [] : [k]).map(n => [n, keyText(n)]), k);
      const isConst = v && typeof v === 'object' && 'const' in v;
      const vSel = select(draft.inputs.map(x => [x.name, `the input ${x.name}`]).concat([['__const', 'this value…']]), isConst ? '__const' : v);
      const cv = input(isConst ? String(v.const) : '', { placeholder: 'value' });
      cv.hidden = !isConst;
      const commit = () => {
        const next = {};
        Object.keys(r.match).forEach(x => { if (x === k) next[kSel.value] = vSel.value === '__const' ? { const: cv.value } : vSel.value; else if (x !== kSel.value) next[x] = r.match[x]; });
        r.match = next; changed();
      };
      kSel.onchange = () => { commit(); api.state.open = 'm:' + kSel.value; api.paint(); };
      vSel.onchange = () => { cv.hidden = vSel.value !== '__const'; commit(); api.soft(); };
      cv.oninput = () => { commit(); api.soft(); };
      box.appendChild(set('Its value', null, kSel));
      const ew = set('Equals', 'a blank optional input matches anything', vSel); ew.appendChild(cv);
      box.appendChild(ew);
      box.appendChild(btn('Remove this match', 'small', () => { delete r.match[k]; api.state.open = null; changed(); api.paint(); }));
    }
    function returnProps(box) {
      const r = draft.reads;
      const cont = containersOf(r.structure);
      const ret = r.return;
      const whole = ret === '*' || ret == null;
      const picked = whole ? [] : Array.isArray(ret) ? ret : [ret];
      box.appendChild(set('Gives back', 'one value, several (a record), or the whole item', chips([['the whole item', 'container' + (whole ? ' on' : ''), '*']].concat(cont.map(c => [c, 'container' + (picked.includes(c) ? ' on' : ''), c])), c => {
        if (c === '*') r.return = '*';
        else { const now = picked.includes(c) ? picked.filter(x => x !== c) : picked.concat(c); r.return = !now.length ? '*' : now.length === 1 ? now[0] : now; }
        if (!['latest', 'first', 'count', 'list'].includes(r.summary || 'latest') && (typeof r.return !== 'string' || r.return === '*')) r.summary = 'latest';
        syncOutput(); changed(); api.paint();
      })));
      // sum, average, min and max need one container to work on (F4).
      const list = (r.from || 'items') === 'items' || typeof r.return !== 'string' || r.return === '*' ? ['latest', 'first', 'count', 'list'] : FP.summary.rules;
      const su = select(list.map(x => [x, SUMMARY_TEXT[x] || x]), r.summary || 'latest');
      su.onchange = () => { r.summary = su.value; syncOutput(); changed(); api.soft(); };
      box.appendChild(set('When several match', null, su));
      box.appendChild(el('p', 'ffe-note', `It gives ${gives()}.`));
    }
    function windowProps(box) {
      const r = draft.reads;
      const w = r.window;
      const wv = w && typeof w === 'object' ? 'days' : w || 'form';
      const ws = select([['form', 'recent data (what the structure keeps loaded)'], ['days', 'the last few days'], ['all', 'everything'], ['always-current', 'always today\'s data']], wv);
      const dn = input(w && w.days ? String(w.days) : '30', { type: 'number', min: 1 });
      dn.hidden = wv !== 'days';
      const setW = () => { if (ws.value === 'form') delete r.window; else if (ws.value === 'days') r.window = { days: Math.max(1, Number(dn.value) || 30) }; else r.window = ws.value; changed(); api.soft(); };
      ws.onchange = () => { dn.hidden = ws.value !== 'days'; setW(); };
      dn.oninput = setW;
      const wb = el('div'); wb.append(ws, dn);
      box.appendChild(set('Looks at', null, wb));
    }

    function build(a, box) {
      api = a;
      const { row, head, addRow, tag, mv } = a;
      const doc = FP.defs.get('function', ctx.id);
      row(box, { key: 'top', color: '#7c3aed', cls: 'top', title: () => draft.label || ctx.id,
        sub: () => [`function ${ctx.id}`, doc ? `v${doc.version}` : 'new', isLookup() ? `reads ${stLabel((draft.reads || {}).structure)}` : 'works out a value', (draft.sites || []).join(', ')].filter(Boolean).join(' · '), props: topProps });

      head(box, 'Inputs', `what a formula gives it, in order: ${ctx.id}(${draft.inputs.map(x => x.name).join(', ')})`);
      draft.inputs.forEach((inp, i) => {
        row(box, { key: 'in:' + i, depth: 1, color: '#a78bfa', cls: 'val', title: () => draft.inputs[i] ? draft.inputs[i].name : '',
          sub: () => draft.inputs[i] ? `${draft.inputs[i].type || 'any'} · ${draft.inputs[i].required === false ? 'optional' : 'needed'}` : '',
          tools: [mv(draft.inputs, i, -1, () => { changed(); a.paint(); }), mv(draft.inputs, i, 1, () => { changed(); a.paint(); })], props: p => inputProps(i, p) });
      });
      addRow(box, '+in', '+ input', 1, null, () => { let k = 1; while (draft.inputs.some(x => x.name === 'input' + k)) k++; draft.inputs.push({ name: 'input' + k, type: 'text' }); a.state.open = 'in:' + (draft.inputs.length - 1); changed(); a.paint(); });

      if (!isLookup()) {
        head(box, 'Formula', 'what it works out');
        row(box, { key: 'fx', depth: 1, color: '#7c3aed', title: () => draft.formula ? `= ${draft.formula}` : 'write the formula', sub: () => `gives ${gives()}`, props: formulaProps });
      } else {
        const r = draft.reads = draft.reads || {};
        head(box, 'Reads', 'the structure it looks in');
        row(box, { key: 'rd', depth: 1, color: '#0e7490', cls: 'src', title: () => stLabel(r.structure),
          sub: () => r.structure ? [(r.from || 'items') === 'entries' ? 'every save (history)' : 'its items as they are now', r.action ? `only "${r.action}" saves` : null].filter(Boolean).join(' · ') : 'tap to choose',
          tags: () => [tag(r.structure ? 'structure' : 'not chosen')], props: readsProps });
        if (r.structure) {
          r.match = r.match || {};
          Object.keys(r.match).forEach(k => row(box, { key: 'm:' + k, depth: 2, color: '#9fd3dc', cls: 'val', title: () => `only where ${keyText(k)}`,
            sub: () => { const v = (r.match || {})[k]; return v && typeof v === 'object' ? `= "${v.const}"` : `= input ${v}`; }, props: p => matchProps(k, p) }));
          addRow(box, '+m', '+ only where…', 2, null, () => { const k = keysOf(r).find(n => !(n in r.match)) || '$id'; r.match[k] = draft.inputs[0] ? draft.inputs[0].name : { const: '' }; a.state.open = 'm:' + k; changed(); a.paint(); });
          head(box, 'Gives back');
          row(box, { key: 'ret', depth: 1, color: '#7c3aed', title: () => { const x = r.return; return x === '*' || x == null ? 'the whole item' : [].concat(x).join(', '); }, sub: () => (['list', 'count'].includes(r.summary) ? SUMMARY_TEXT[r.summary] : `${SUMMARY_TEXT[r.summary || 'latest']} · ${gives()}`), props: returnProps });
          row(box, { key: 'win', depth: 1, color: '#64748b', title: () => 'Looks at', sub: () => { const w = r.window; return w && typeof w === 'object' ? `the last ${w.days} days` : WINDOW_TEXT[w || 'form']; }, props: windowProps });
        }
      }

      const users = FP.map.usedBy('function', ctx.id);
      head(box, 'Used by', users.length ? null : 'nothing yet');
      users.forEach((u, i) => {
        const fn = !u.form && /^function (\w+)/.exec(u.title || '');
        const st = !u.form && /^structure ([a-z0-9-]+)/.exec(u.title || '');
        const go = u.form ? () => ctx.open('form', u.form) : fn ? () => ctx.open('function', fn[1]) : st ? () => ctx.open('structure', st[1]) : null;
        row(box, { key: 'u:' + i, depth: 1, color: u.form ? '#2a78d6' : '#7c3aed', cls: 'kid', title: () => u.title, sub: () => [u.field, u.how].filter(Boolean).join(' · '),
          tools: ctx.open && go ? [btn('Edit ›', 'small', e => { e.stopPropagation(); go(); })] : [], act: () => {} });
      });
    }

    // Right: try it with values typed here (nothing is saved).
    const tries = {};
    let args = null, out = null, pt = null;
    function paintArgs() {
      if (!args) return;
      args.replaceChildren();
      if (!draft.inputs.length) args.appendChild(el('p', 'ffe-note', 'No inputs: it works the same every time.'));
      draft.inputs.forEach(x => {
        const i = input(tries[x.name] == null ? '' : tries[x.name], { placeholder: x.type || 'any' });
        i.oninput = () => { tries[x.name] = i.value; schedule(); };
        args.appendChild(set(x.name + (x.required === false ? '' : ' *'), x.type && x.type !== 'any' ? x.type : null, i));
      });
    }
    function schedule() { clearTimeout(pt); pt = setTimeout(run, 400); }
    async function run() {
      if (!out) return;
      const tmp = 'ZzTry' + Date.now();
      const def = Object.assign({}, clone(draft), { name: tmp });
      delete def.sites;
      try {
        FP.fn.define(def);
        const a = {};
        draft.inputs.forEach(x => { const v = tries[x.name]; a[x.name] = v == null || v === '' ? null : x.type === 'number' ? Number(v) : x.type === 'boolean' ? /^(true|yes|1)$/i.test(v) : v; });
        const v = await FP.fn.callAsync(tmp, a, {});
        out.replaceChildren(el('div', 'fsm-label', 'It gives'));
        if (Array.isArray(v)) {
          out.appendChild(el('div', 'fpe-hint', `${v.length} match${v.length === 1 ? '' : 'es'}${v.length > 10 ? ', the first 10:' : ''}`));
          v.slice(0, 10).forEach(x => out.appendChild(el('div', 'ffe-note', typeof x === 'object' ? JSON.stringify(x) : String(x))));
        } else out.appendChild(el('div', 'fsm-out', v && typeof v === 'object' && !v.__fp ? JSON.stringify(v) : FP.fn.describe(v).text));
      } catch (e) { out.replaceChildren(el('div', 'fsm-label', 'It can\'t run yet'), el('div', 'fpe-warn', 'Fix what is marked ✗ on the map first.')); }
      finally { FP.fn.remove(tmp); }
    }
    return mapView(ctx, {
      stateKey: 'fnState', top: 'top', marked: /^(top$|in:|fx$|rd$|m:|ret$|win$)/,
      problemKey(t) {
        let m;
        if ((m = /^(?:Bad input name |Input )([A-Za-z0-9_]*)/.exec(t))) { const i = draft.inputs.findIndex(x => x.name === m[1]); return i >= 0 ? 'in:' + i : 'top'; }
        if (/^A function name|built-in function name|^Kind must|\bsites?\b|uses it at|would break/.test(t)) return 'top';
        if (!isLookup()) return 'fx';
        if ((m = /^match (\S+) uses/.exec(t))) return 'm:' + m[1];
        if (/^Bad structure|^from must/.test(t)) return 'rd';
        if (/^return needs|summary must|^Over items|This lookup gives/.test(t)) return 'ret';
        if (/^window must/.test(t)) return 'win';
        return 'top';
      },
      build,
      right(prev) {
        const h = el('header'); h.appendChild(el('span', null, 'Try it · nothing is saved'));
        args = el('div', 'fsm-body');
        out = el('div', 'fsm-body fsm-result');
        prev.append(h, args, out);
        paintArgs(); run();
      },
      onOpen: () => paintArgs(),
    });
  }


  FP.editor.formEditor = formEditor;
  FP.editor.screenFit = screenFit;   // the publish check (0.44)
  FP.editor.functionEditor = functionEditor;
  FP.editor.structureMap = structureMap;
  FP.editor.mapView = mapView;
  FP.editor.tidyForm = tidyForm;
  FP.editor.toSources = toSources;

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-form-editor'] = '0.63.0';
})();
