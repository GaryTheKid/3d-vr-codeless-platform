// React 启动入口。App.useEffect 在首次 commit 后加载 Three.js/Agent runtime，
// 因而旧 controller 绑定时全部稳定 DOM id 已经存在。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './js/ui/react-app.js';

const rootEl = document.getElementById('root');
const root = createRoot(rootEl);
root.render(React.createElement(App));
