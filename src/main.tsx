import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { installTextures } from './ui/scenes/textures';
import './ui/styles/fonts.generated.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/scenes.css';
import './ui/styles/menu.css';
import './ui/styles/builder.css';
import './ui/styles/game.css';
import './ui/styles/fx.css';
import './ui/styles/rules.css';
import './ui/styles/inspector.css';
import './ui/styles/online.css';
import './ui/styles/draft.css';

installTextures();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
