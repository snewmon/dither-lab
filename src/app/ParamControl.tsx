import type { ParamDef } from '../engine/types';
import './ParamControl.css';

interface Props {
  label: string;
  def: ParamDef;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function ParamControl({ label, def, value, onChange }: Props) {
  return (
    <div class="param-row">
      <label class="param-label">{label}</label>
      {def.type === 'range' && (
        <div class="param-range">
          <input
            type="range"
            min={def.min} max={def.max} step={def.step}
            value={value as number}
            onInput={e => onChange(parseFloat((e.target as HTMLInputElement).value))}
          />
          <span class="param-value">{value as number}</span>
        </div>
      )}
      {def.type === 'select' && (
        <select
          value={value as string}
          onChange={e => onChange((e.target as HTMLSelectElement).value)}
        >
          {def.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {def.type === 'toggle' && (
        <button
          class={`param-toggle ${value ? 'on' : 'off'}`}
          onClick={() => onChange(!value)}
        >
          {value ? 'on' : 'off'}
        </button>
      )}
    </div>
  );
}
