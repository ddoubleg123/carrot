import React, { useEffect, useState } from 'react';

interface Question {
  id: string;
  slug: string;
  label: string;
  type: string;
  options?: any[];
}

interface Answer {
  questionId: string;
  answer: any;
}

export default function OnboardingSurveyStep({ onComplete }: { onComplete: () => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding-questions')
      .then(res => res.json())
      .then(setQuestions)
      .finally(() => setLoading(false));
  }, []);

  function handleChange(qid: string, value: any) {
    setAnswers(a => ({ ...a, [qid]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    await fetch('/api/onboarding-answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    onComplete();
  }

  if (loading) return <div>Loading questions…</div>;
  if (!questions.length) return <div>No onboarding questions found.</div>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {questions.map(q => (
        <div key={q.id}>
          <label className="block font-medium mb-1">{q.label}</label>
          {q.type === 'text' && (
            <input
              className="border rounded px-3 py-2 w-full"
              value={answers[q.id] || ''}
              onChange={e => handleChange(q.id, e.target.value)}
              type="text"
            />
          )}
          {q.type === 'multi-select' && Array.isArray(q.options) && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt: any) => (
                <label key={opt.value} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={Array.isArray(answers[q.id]) ? answers[q.id].includes(opt.value) : false}
                    onChange={e => {
                      const prev = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                      handleChange(q.id, e.target.checked ? [...prev, opt.value] : prev.filter((v: any) => v !== opt.value));
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
          {q.type === 'rating' && (
            <div className="flex gap-2">
              {[1,2,3,4,5].map(val => (
                <button
                  key={val}
                  type="button"
                  className={
                    'px-3 py-1 rounded ' +
                    (answers[q.id] === val ? 'bg-orange-400 text-white' : 'bg-gray-200')
                  }
                  onClick={() => handleChange(q.id, val)}
                >{val}</button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="submit" className="mt-4 bg-orange-500 text-white px-6 py-2 rounded font-bold shadow" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Continue'}
      </button>
    </form>
  );
}
