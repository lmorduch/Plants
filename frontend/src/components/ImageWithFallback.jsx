// ABOUTME: Renders an image, showing a fallback element when the src is empty or fails to load.
// ABOUTME: Used for plant/care photos so a missing file shows a placeholder, not a broken icon.
import { useState, useEffect } from 'react';

export default function ImageWithFallback({ src, fallback, ...imgProps }) {
  const [errored, setErrored] = useState(false);

  useEffect(() => { setErrored(false); }, [src]);

  if (!src || errored) return fallback;
  return <img src={src} onError={() => setErrored(true)} {...imgProps} />;
}
