/**
 * Blastocyst / Day 5/6/7 — same structure as CleavageStage but for later stages.
 * Accepts stageTitle, stageId, stageKey props to support Day 5, Day 6, Day 7 separately.
 */
import React from 'react';
import CleavageStage from './CleavageStage';

function BlastocystStage({ sessionId, caseData, onComplete, onViewStatus, stageTitle = 'Blastocyst (Day 5)', stageId = 'blastocyst', stageKey = 'blastocyst' }) {
  return (
    <CleavageStage
      sessionId={sessionId}
      caseData={caseData}
      onComplete={onComplete}
      onViewStatus={onViewStatus}
      stageTitle={stageTitle}
      stageId={stageId}
      stageKey={stageKey}
    />
  );
}

export default BlastocystStage;
