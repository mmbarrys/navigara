import React from 'react';

// Regex untuk mendeteksi link
const urlRegex = /(https?:\/\/[^\s]+)/g;

const AiOutput = ({ text }) => {
  if (!text) return null;

  // 1. Ubah **teks** menjadi <strong>teks</strong> dan *teks* menjadi <em>teks</em>
  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 2. Pisahkan berdasarkan baris baru
  const lines = formattedText.split('\n');

  return (
    <div className="ai-output-container">
      {lines.map((line, index) => {
        // 3. Ubah list (yang dimulai dengan * atau -)
        if (line.trim().startsWith('<strong>')) {
          // Jika ini adalah sub-judul (e.g., **1. Analisis CV**)
          return <p key={index} dangerouslySetInnerHTML={{ __html: line }} style={{ margin: '15px 0 5px 0' }} />;
        }
        
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          const lineContent = line.substring(2);
          // 4. Deteksi link di dalam list
          const parts = lineContent.split(urlRegex);
          return (
            <li key={index} style={{ marginLeft: '20px' }}>
              {parts.map((part, i) => 
                urlRegex.test(part) ? 
                <a href={part} key={i} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent-blue)'}}>{part}</a> : 
                <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
              )}
            </li>
          );
        }

        if (line.trim() === '') {
          return <br key={index} />;
        }
        
        // 5. Deteksi link di paragraf biasa
        const parts = line.split(urlRegex);
        return (
          <p key={index} style={{ margin: '5px 0' }}>
            {parts.map((part, i) => 
              urlRegex.test(part) ? 
              <a href={part} key={i} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent-blue)'}}>{part}</a> : 
              <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
            )}
          </p>
        );
      })}
    </div>
  );
};

export default AiOutput;