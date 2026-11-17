import { useRef, useState } from 'react';
import { ImagePlus, Link2, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { img } from '../lib/format';
import { Button, Input, cx } from '../ui';

const MAX_BYTES = 10 * 1024 * 1024;

/** Uploads one image straight to Cloudinary using a server-signed request. Returns the https URL. */
export async function uploadImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
  if (file.size > MAX_BYTES) throw new Error('Images must be under 10 MB');
  const sig = await api('/admin/uploads/signature');
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', sig.timestamp);
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Upload failed');
  return data.secure_url;
}

/** Single image: upload or paste a link. `aspect` is a Tailwind aspect class for the preview. */
export default function ImageInput({ value, onChange, aspect = 'aspect-[16/9]', label = 'Image' }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);
  const [link, setLink] = useState('');

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err.message);
      if (/isn’t set up/.test(err.message)) setPasting(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={cx('stripes relative overflow-hidden rounded-2xl border border-glass-border', aspect)}>
        {value && <img src={img(value, 900)} alt="" className="absolute inset-0 size-full object-cover" />}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <Loader2 className="size-6 animate-spin text-white" aria-label="Uploading" />
          </div>
        )}
        {value && !busy && (
          <button type="button" onClick={() => onChange('')} className="glass-solid absolute right-2 top-2 grid size-8 place-items-center rounded-full" aria-label={`Remove ${label.toLowerCase()}`}>
            <X className="size-4" />
          </button>
        )}
        {!value && !busy && (
          <button type="button" onClick={() => fileRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted hover:text-text">
            <ImagePlus className="size-6" strokeWidth={1.5} aria-hidden />
            Upload {label.toLowerCase()}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          <ImagePlus className="size-3.5" aria-hidden /> {value ? 'Replace' : 'Upload'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setPasting((p) => !p)}>
          <Link2 className="size-3.5" aria-hidden /> Paste link
        </Button>
      </div>
      {pasting && (
        <div className="mt-2 flex gap-2">
          <Input type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} aria-label={`${label} link`} className="h-10 text-sm" />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!/^https:\/\//.test(link.trim())) return setError('Use an https:// link');
              onChange(link.trim());
              setLink('');
              setPasting(false);
              setError('');
            }}
          >
            Use
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}

/** Up to `max` images, each uploaded or pasted. */
export function GalleryInput({ value = [], onChange, max = 6 }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFiles(e) {
    const files = [...(e.target.files || [])].slice(0, max - value.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadImage(f));
      onChange([...value, ...urls]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((u) => (
          <div key={u} className="relative aspect-[3/4] overflow-hidden rounded-2xl">
            <img src={img(u, 400)} alt="" className="size-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((x) => x !== u))} className="glass-solid absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full" aria-label="Remove image">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="stripes grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-border-strong text-muted hover:text-text"
            aria-label="Add images"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" strokeWidth={1.5} />}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
