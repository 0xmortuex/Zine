import { useEffect, useState } from 'react'

/** Blob → object URL, revoked automatically when the blob changes/unmounts. */
export function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return url
}
