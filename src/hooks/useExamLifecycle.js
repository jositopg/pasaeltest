import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function useExamLifecycle({ saveExamResult, setScreen }) {
  const [examConfig, setExamConfig] = useState(null);
  const [reviewFailed, setReviewFailed] = useState(null);

  const startExam = (config) => {
    setExamConfig(config);
    setScreen('exam-active');
  };

  const finishExam = async (score, flags = [], reviewQs = null) => {
    await saveExamResult(examConfig, score);
    if (reviewQs?.length > 0) {
      setReviewFailed(reviewQs);
      setScreen('review');
    } else {
      setReviewFailed(null);
      setScreen('home');
    }

    if (flags.length > 0) {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }));
      if (session?.access_token) {
        flags.forEach(({ question, comment }) => {
          fetch('/api/report-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({
              questionId: question.id,
              userComment: comment,
              questionSnapshot: {
                text: question.text,
                options: question.options,
                correct_answer: question.correct ?? question.correct_answer,
                explanation: question.explanation,
              },
            }),
          }).catch((err) => console.error('Error reporting question:', err));
        });
      }
    }
  };

  return { examConfig, reviewFailed, setReviewFailed, startExam, finishExam };
}
