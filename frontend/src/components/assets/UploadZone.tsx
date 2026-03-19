import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import api from '../../utils/api'
import { formatFileSize } from '../../utils/format'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface FileUpload {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
}

interface Props {
  projectId: number
  onSuccess: () => void
  onClose: () => void
}

export default function UploadZone({ projectId, onSuccess, onClose }: Props) {
  const [files, setFiles] = useState<FileUpload[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((f) => ({ file: f, progress: 0, status: 'pending' as const })),
    ])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'video/*': [],
      'audio/*': [],
      'application/pdf': [],
    },
    maxSize: 150 * 1024 * 1024 * 1024, // 150 GB (admin has no limit server-side)
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)

    const formData = new FormData()
    files.forEach(({ file }) => formData.append('files', file))

    try {
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' })))
      await api.post(`/assets/upload/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'done', progress: 100 })))
      toast.success(`${files.length} file(s) uploaded! AI analysis in progress…`)
      onSuccess()
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'error' })))
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <div className="p-5 border-b border-surface-300 flex items-center justify-between">
          <h3 className="font-semibold text-white">Upload Assets</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-300 hover:border-brand-500/50 hover:bg-surface-100'
            )}
          >
            <input {...getInputProps()} />
            <Upload size={32} className="text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Drop files here</p>
            <p className="text-slate-500 text-sm mt-1">Images, videos, audio, PDFs · Maks 150 GB (Admin: sınırsız)</p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((fu, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{fu.file.name}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(fu.file.size)}</p>
                  </div>
                  <div className="shrink-0">
                    {fu.status === 'pending' && (
                      <button onClick={() => removeFile(i)} className="text-slate-500 hover:text-red-400">
                        <X size={14} />
                      </button>
                    )}
                    {fu.status === 'uploading' && <Loader2 size={14} className="text-brand-400 animate-spin" />}
                    {fu.status === 'done' && <CheckCircle size={14} className="text-emerald-400" />}
                    {fu.status === 'error' && <AlertCircle size={14} className="text-red-400" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-surface-300 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="btn-primary flex-1 justify-center"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload size={14} />
                Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
