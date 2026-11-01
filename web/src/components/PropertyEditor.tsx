'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MLMap } from 'maplibre-gl';
import type { InfoItem, Property, PropertyInput } from '@/lib/types';
import { polygonStats, type Pt } from '@/lib/map/geo';
import { clearParcelPreview, previewParcel, startParcelDraw } from '@/lib/map/parcelDraw';

type Props = {
  map: MLMap | null;
  types: string[];
  /** Đang sửa tin này (null = đang thêm mới / không làm gì). */
  editing: Property | null;
  /** Gọi trước khi vẽ/sửa: dừng xoay, thoát công cụ vẽ nhà; closeDetail = đóng panel chi tiết. */
  beforeStart: (closeDetail: boolean) => void;
  onSaved: (p: Property) => void;
  /** Kết thúc việc sửa (lưu xong hoặc hủy). */
  onEditEnd: () => void;
};

type Phase = 'idle' | 'drawing' | 'form';
const DEFAULT_TYPES = ['Đất nền', 'Nhà phố', 'Biệt thự', 'Shophouse', 'Căn hộ'];
const DEFAULT_ROWS: InfoItem[] = [{ label: 'Hướng', value: '' }, { label: 'Pháp lý', value: '' }, { label: 'Đường', value: '' }];

export default function PropertyEditor({ map, types, editing, beforeStart, onSaved, onEditEnd }: Props) {
  const stopRef = useRef<((clear?: boolean) => void) | null>(null);
  const ringRef = useRef<Pt[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState('');

  const [type, setType] = useState('Đất nền');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<'tỷ' | 'triệu'>('tỷ');
  const [area, setArea] = useState('');
  const [phone, setPhone] = useState('');
  const [image, setImage] = useState('');
  const [desc, setDesc] = useState('');
  const [rows, setRows] = useState<InfoItem[]>(DEFAULT_ROWS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.toggle('parcel-mode', phase !== 'idle');
    return () => document.body.classList.remove('parcel-mode');
  }, [phase]);

  useEffect(() => () => { try { stopRef.current?.(false); } catch { /* bản đồ đã bị gỡ */ } }, []);

  function resetForm() {
    setType('Đất nền'); setTitle(''); setPrice(''); setUnit('tỷ'); setArea(''); setPhone(''); setImage(''); setDesc(''); setRows(DEFAULT_ROWS);
    ringRef.current = []; setError(''); setMsg('');
  }

  // Bấm "Sửa" ở panel chi tiết: đổ dữ liệu của tin vào biểu mẫu và hiện ranh đất hiện tại.
  useEffect(() => {
    if (!editing || !map) return;
    stopRef.current?.(true);
    beforeStart(false);
    const ty = editing.priceVnd >= 1e9;
    setType(editing.type); setTitle(editing.title); setUnit(ty ? 'tỷ' : 'triệu');
    setPrice(String(+(editing.priceVnd / (ty ? 1e9 : 1e6)).toFixed(3)).replace('.', ','));
    setArea(String(editing.areaM2)); setPhone(editing.phone); setImage(editing.image); setDesc(editing.desc);
    setRows(editing.info.length ? editing.info : DEFAULT_ROWS);
    ringRef.current = editing.polygon; setError(''); setMsg('');
    previewParcel(map, editing.polygon);
    setPhase('form');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, map]);

  function start() {
    if (!map) return;
    stopRef.current?.(true);
    beforeStart(!editing);
    setMsg(''); setError(''); setPhase('drawing');
    stopRef.current = startParcelDraw(map, {
      onChange: (n) => {
        if (n >= 0) { setCount(n); setMsg(''); return; }
        // Esc / Hủy khi đang vẽ: nếu đã có ranh đất trước đó thì quay lại biểu mẫu, không thì thoát.
        if (ringRef.current.length >= 3) { previewParcel(map, ringRef.current); setPhase('form'); } else setPhase('idle');
      },
      onInvalid: setMsg,
      onDone: (r) => {
        ringRef.current = r;
        setArea(String(Math.round(polygonStats(r).areaM2)));
        setPhase('form');
      },
    });
  }

  /** Bỏ hẳn (nút Hủy ở biểu mẫu). */
  function cancel() {
    stopRef.current?.(true);
    if (map) clearParcelPreview(map);
    resetForm(); setPhase('idle');
    if (editing) onEditEnd();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!map) return;
    setSaving(true); setError('');
    const ring = ringRef.current;
    const input: PropertyInput = {
      type: type.trim(), title: title.trim(),
      priceVnd: Math.round(Number(price.replace(',', '.')) * (unit === 'tỷ' ? 1e9 : 1e6)),
      areaM2: Number(area.replace(',', '.')),
      lng: polygonStats(ring).center[0], lat: polygonStats(ring).center[1],
      polygon: ring, info: rows.filter((r) => r.label.trim() && r.value.trim()),
      desc: desc.trim(), phone: phone.trim(), image: image.trim(),
    };
    try {
      const res = await fetch(editing ? `/api/admin/properties/${encodeURIComponent(editing.slug)}` : '/api/admin/properties', {
        method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
      });
      if (res.status === 401) { window.location.href = '/admin/login'; return; }
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.errors ? (Object.values(body.errors) as string[][]).flat().join(' ') : body?.error ?? body?.detail ?? `Lưu thất bại (${res.status}).`);
        return;
      }
      clearParcelPreview(map);
      resetForm(); setPhase('idle');
      if (editing) onEditEnd();
      onSaved(body as Property);
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setSaving(false);
    }
  }

  const setRow = (i: number, patch: Partial<InfoItem>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const typeOptions = [...new Set([...DEFAULT_TYPES, ...types.filter((t) => t !== 'Tất cả')])];

  return (
    <>
      <button id="add-btn" className="cta" onClick={() => { resetForm(); start(); }} disabled={!map || phase !== 'idle'}>＋ Thêm bất động sản</button>

      {phase !== 'idle' && createPortal(<>
        {phase === 'drawing' && (
          <div id="parcel-hint">
            <span>Bấm để chấm từng góc khu đất ({count} điểm) · Bấm lại điểm đầu hoặc Enter để hoàn tất · Backspace lùi · Esc hủy</span>
            {msg && <strong>{msg}</strong>}
            <button onClick={() => stopRef.current?.(true)}>Hủy</button>
          </div>
        )}

        {phase === 'form' && (
          <form id="add-form" onSubmit={submit}>
            <h3>{editing ? 'Sửa bất động sản' : 'Thêm bất động sản'}</h3>
            <label>Loại
              <input list="add-types" required maxLength={40} value={type} onChange={(e) => setType(e.target.value)} />
              <datalist id="add-types">{typeOptions.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <label>Tên / tiêu đề
              <input required minLength={3} maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </label>
            <div className="row">
              <label>Giá
                <span className="inline">
                  <input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                  <select value={unit} onChange={(e) => setUnit(e.target.value as 'tỷ' | 'triệu')}><option>tỷ</option><option>triệu</option></select>
                </span>
              </label>
              <label>Diện tích (m²)
                <input required inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} />
              </label>
            </div>
            <p className="note">Vẽ lại ranh đất sẽ tự tính lại diện tích; bạn vẫn sửa được theo sổ.</p>
            <label>Số điện thoại liên hệ
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>Đường dẫn ảnh (không bắt buộc)
              <input type="url" placeholder="https://..." value={image} onChange={(e) => setImage(e.target.value)} />
            </label>
            <fieldset>
              <legend>Thông tin thêm</legend>
              {rows.map((r, i) => (
                <div className="info-row" key={i}>
                  <input aria-label="Nhãn" placeholder="Nhãn" value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                  <input aria-label="Giá trị" placeholder="Giá trị" value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                  <button type="button" aria-label="Xóa dòng" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}>×</button>
                </div>
              ))}
              {rows.length < 20 && <button type="button" className="ghost" onClick={() => setRows((rs) => [...rs, { label: '', value: '' }])}>＋ Thêm dòng</button>}
            </fieldset>
            <label>Mô tả
              <textarea rows={4} maxLength={5000} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </label>
            {error && <p className="err">{error}</p>}
            <div className="row">
              <button type="button" className="ghost" onClick={start}>Vẽ lại ranh đất</button>
              <button type="button" className="ghost" onClick={cancel}>Hủy</button>
            </div>
            <button className="cta" disabled={saving}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu bất động sản'}</button>
          </form>
        )}
      </>, document.body)}
    </>
  );
}
