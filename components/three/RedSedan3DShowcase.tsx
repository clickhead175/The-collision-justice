'use client';

import Image from 'next/image';
import { useState, type PointerEvent } from 'react';

const inspectionPoints = [
  { title: 'Front Bumper & Lights', detail: 'Note visible damage around the front bumper, grille, and lights.', position: { left: '3%', top: '58%', transform: 'translateY(-50%)' } },
  { title: 'Cabin & Doors', detail: 'Check the doors, windows, and cabin for damage or belongings.', position: { left: '50%', top: '47%', transform: 'translate(-50%, -50%)' } },
  { title: 'Rear Quarter', detail: 'Photograph the rear panels and nearby parts from several angles.', position: { left: '97%', top: '58%', transform: 'translate(-100%, -50%)' } },
  { title: 'Claim Documentation', detail: 'Keep photographs and repair or incident documents together.', position: { left: '97%', top: '23%', transform: 'translate(-100%, -50%)' } },
];

export default function RedSedanShowcase() {
  const [activePoint, setActivePoint] = useState(0);

  function updateTilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.transform = `perspective(1000px) rotateX(${y * -5}deg) rotateY(${x * 7}deg)`;
  }

  return (
    <div className="cj-sedan-showcase">
      <div
        className="cj-sedan-canvas"
        role="group"
        aria-label="Interactive crimson red sedan inspection showcase"
        onPointerMove={updateTilt}
        onPointerLeave={(event) => { event.currentTarget.style.transform = ''; }}
      >
        <div className="cj-sedan-car-image">
          <Image
            src="/images/red-sedan.jpg"
            alt="Modern red four-door sedan photographed from the front and side"
            fill
            quality={75}
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 500px"
          />
        </div>
        <span className="cj-sedan-photo-gradient" aria-hidden="true" />
        {inspectionPoints.map((point, index) => (
          <button
            className={`cj-sedan-hotspot${activePoint === index ? ' is-active' : ''}`}
            key={point.title}
            type="button"
            aria-pressed={activePoint === index}
            aria-label={`${point.title}: ${point.detail}`}
            style={point.position}
            onClick={() => setActivePoint(index)}
          >
            {point.title}
          </button>
        ))}
        <a
          className="cj-sedan-photo-credit"
          href="https://unsplash.com/photos/a-red-car-parked-on-asphalt-with-green-trees-oOvgybYOn0U"
          target="_blank"
          rel="noreferrer"
        >
          Photo by Lucas on Unsplash
        </a>
      </div>
    </div>
  );
}
