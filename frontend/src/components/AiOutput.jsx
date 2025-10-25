import React from 'react';

const AiOutput = ({ text }) => {
  if (!text) return null;
  const formattedText = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
  return (
    <div className="ai-output-container">
      {formattedText.split('\n').map((line, index) => {
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          return <li key={index} dangerouslySetInnerHTML={{ __html: line.substring(2) }} style={{ marginLeft: '20px' }} />;
        }
        if (line.trim() === '') return <br key={index} />;
        return <p key={index} dangerouslySetInnerHTML={{ __html: line }} style={{ margin: '5px 0' }} />;
      })}
    </div>
  );
};
export default AiOutput;