import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideProps,
} from "lucide-react";

interface FileIconProps extends LucideProps {
  name: string;
  mimeType?: string;
}

const byExtension: Record<string, typeof File> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  rtf: FileText,
  pages: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  numbers: FileSpreadsheet,
  zip: FileArchive,
  rar: FileArchive,
  "7z": FileArchive,
  gz: FileArchive,
  tar: FileArchive,
  json: FileCode,
  html: FileCode,
  xml: FileCode,
};

/** Lucide file icon matching the attachment's type. */
export function FileIcon({ name, mimeType = "", ...props }: FileIconProps) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = mimeType.startsWith("image/")
    ? FileImage
    : mimeType.startsWith("audio/")
      ? FileAudio
      : mimeType.startsWith("video/")
        ? FileVideo
        : (byExtension[extension] ?? File);
  return <Icon {...props} />;
}
