import { ImageResponse } from 'next/og';
import ShieldMark from '@/components/ui/shield-mark';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <ShieldMark size={30} />
    </div>,
    size,
  );
}
