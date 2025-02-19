// components/preview-attachment.tsx
import { FileText, Image, Loader2 } from 'lucide-react';

export function PreviewAttachmentA({
  attachment,
  isUploading = false
}: {
  attachment: {
    url: string;
    name: string;
    contentType: string;
  };
  isUploading?: boolean;
}) {
  return (
    <div className="relative w-24 h-24 flex flex-col items-center justify-center border rounded-lg p-2">
      {isUploading ? (
        <Loader2 className="animate-spin h-6 w-6" />
      ) : attachment.contentType.startsWith('image/') ? (
        <img
          src={attachment.url}
          alt={attachment.name}
          className="object-cover w-full h-full rounded"
        />
      ) : (
        <>
          <FileText className="h-8 w-8" />
          <span className="text-xs truncate mt-1">{attachment.name}</span>
        </>
      )}
    </div>
  );
}