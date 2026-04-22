/**
 * Blastocyst (Day 5/6) — same structure as CleavageStage but for blastocyst stage.
 */
import React from 'react';
import CleavageStage from './CleavageStage';

function BlastocystStage({ sessionId, caseData, onComplete, onViewStatus }) {
  return (
    <CleavageStage
      sessionId={sessionId}
      caseData={caseData}
      onComplete={onComplete}
      onViewStatus={onViewStatus}
      stageTitle="Blastocyst (Day 5/6)"
      stageId="blastocyst"
      stageKey="blastocyst"
    />
  );
}

export default BlastocystStage;
