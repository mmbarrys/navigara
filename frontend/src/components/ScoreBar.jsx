import React from 'react';

// maxScore: 7 for attributes, 100 for total/SKP
const ScoreBar = ({ score, maxScore = 7, label, delay = 0 }) => {
  const percentage = maxScore === 0 ? 0 : Math.max(0, Math.min(100, (score / maxScore) * 100));
  
  let barColor = 'var(--color-primary)'; // Default blue
  if (maxScore === 100) { // Skala 0-100 (Kinerja/Potensi Total)
      if (percentage < 60) barColor = 'var(--color-error)';
      else if (percentage < 80) barColor = 'var(--color-warning)';
      else barColor = 'var(--color-success)';
  } else { // Skala 1-7 (Atribut)
      if (percentage < 42) barColor = 'var(--color-error)'; // < 3/7
      else if (percentage < 71) barColor = 'var(--color-warning)'; // < 5/7
      else barColor = 'var(--color-success)'; // >= 5/7
  }


  return (
    <div className="score-bar-item animate-fade-in" style={{ animationDelay: `${delay}s` }}>
      <div className="score-bar-label">
        <span>{label}</span>
        <strong>{score}/{maxScore}</strong>
      </div>
      <div className="score-bar-track">
        <div 
          className="score-bar-fill" 
          style={{ width: `${percentage}%`, backgroundColor: barColor, animationDelay: `${delay + 0.2}s` }}
        ></div>
      </div>
    </div>
  );
};

export default ScoreBar;