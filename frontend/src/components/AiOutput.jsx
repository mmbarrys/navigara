import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Komponen BARU untuk merender Markdown
const AiOutput = ({ text }) => {
  if (!text) return null;

  // Hapus baris pemisah --- dan disclaimer AI jika ada
  const cleanedText = text
      .replace(/^-{3,}\s*$/gm, '') // Hapus ---
      .replace(/^\*Disclaimer:.*$/gim, ''); // Hapus disclaimer

  // Komponen kustom untuk merender elemen Markdown (opsional, untuk styling)
  const components = {
    h1: ({node, ...props}) => <h1 style={{color: 'var(--color-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '5px', marginBottom: '15px'}} {...props} />,
    h2: ({node, ...props}) => <h2 style={{color: 'var(--color-accent)', marginTop: '20px', marginBottom: '10px'}} {...props} />,
    h3: ({node, ...props}) => <h3 style={{color: 'var(--color-foreground)', marginTop: '15px', marginBottom: '5px', fontSize: '1.1rem'}} {...props} />,
    strong: ({node, ...props}) => <strong style={{color: 'var(--color-primary)', fontWeight: '600'}} {...props} />,
    em: ({node, ...props}) => <em style={{color: 'var(--color-accent)'}} {...props} />,
    a: ({node, ...props}) => <a style={{color: 'var(--color-primary)'}} target="_blank" rel="noopener noreferrer" {...props} />,
    li: ({node, ...props}) => <li style={{marginBottom: '5px'}} {...props} />,
    p: ({node, ...props}) => <p style={{margin: '8px 0', lineHeight: '1.6'}} {...props} />,
  };

  return (
    <div className="ai-output-container">
      <ReactMarkdown
        children={cleanedText}
        remarkPlugins={[remarkGfm]}
        components={components} // Gunakan komponen kustom
      />
    </div>
  );
};

export default AiOutput;