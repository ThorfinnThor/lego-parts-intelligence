export function ScoreMeter({ label, score }: { label: string; score: number }) {
  const percent = Math.round(score * 100);
  return (
    <div className="score-meter">
      <div className="score-copy"><span>{label}</span><strong>{percent}/100</strong></div>
      <div className="meter-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
