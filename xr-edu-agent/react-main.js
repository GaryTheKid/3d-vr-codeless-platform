// React 启动入口。App.useEffect 在首次 commit 后加载 Three.js/Agent runtime，
// 因而旧 controller 绑定时全部稳定 DOM id 已经存在。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { App } from './js/ui/react-app.js';

const rootEl = document.getElementById('root');
const root = createRoot(rootEl);
// 同步 commit 外壳 DOM，再交给 App.useEffect 加载 legacy runtime
flushSync(() => { root.render(React.createElement(App)); });
