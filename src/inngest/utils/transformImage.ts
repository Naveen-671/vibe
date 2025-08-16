// utils/transformImages.ts
export function transformImages(code: string): string {
  const hasUseClient = code.startsWith("'use client'") || code.startsWith('"use client"');

  // Only insert import if missing
  if (!code.includes("from 'next/image'") && !code.includes('from "next/image"')) {
    if (hasUseClient) {
      code = code.replace(
        /(['"]use client['"];?)/,
        `$1\n\nimport Image from "next/image";`
      );
    } else {
      code = `import Image from "next/image";\n` + code;
    }
  }

  // Replace <img> → <Image width={} height={}>
  code = code
    .replace(/<img([^>]*)\/>/g, (match, attrs) => `<Image${attrs} width={400} height={300} />`)
    .replace(/<img([^>]*)>/g, (match, attrs) => `<Image${attrs} width={400} height={300} />`)
    .replace(/<\/img>/g, "");

  return code;
}
