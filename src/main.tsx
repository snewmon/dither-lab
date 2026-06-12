import { render } from 'preact';
import { App } from './app/App';
import './app/global.css';

render(<App />, document.getElementById('app')!);
