'use client';

import React, { useEffect, useState } from 'react';

interface Question {
  id: string;
  slug: string;
  label: string;
  type: string;
  options?: any[];
}

export default function OnboardingQuestionsAdminPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQ, setNewQ] = useState<Partial<Question>>({ type: 'text', options: [] });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding-questions')
      .then(res => res.json())
      .then(setQuestions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQ),
      });
      if (!res.ok) throw new Error('Failed to create question');
      const created = await res.json();
      setQuestions(qs => [...qs, created]);
      setNewQ({ type: 'text', options: [] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOptionChange(idx: number, value: string) {
    setNewQ(q => ({ ...q, options: q.options?.map((opt, i) => i === idx ? { ...opt, label: value, value } : opt) }));
  }

  function addOption() {
    setNewQ(q => ({ ...q, options: [...(q.options || []), { label: '', value: '' }] }));
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Onboarding Questions Admin</h1>
      <form onSubmit={handleCreate} className="mb-8 bg-white rounded shadow p-4 flex flex-col gap-4">
        <div>
          <label className="block font-medium mb-1">Slug</label>
          <input value={newQ.slug || ''} onChange={e => setNewQ(q => ({ ...q, slug: e.target.value }))} className="border rounded px-3 py-2 w-full" required />
        </div>
        <div>
          <label className="block font-medium mb-1">Label</label>
          <input value={newQ.label || ''} onChange={e => setNewQ(q => ({ ...q, label: e.target.value }))} className="border rounded px-3 py-2 w-full" required />
        </div>
        <div>
          <label className="block font-medium mb-1">Type</label>
          <select value={newQ.type} onChange={e => setNewQ(q => ({ ...q, type: e.target.value }))} className="border rounded px-3 py-2 w-full">
            <option value="text">Text</option>
            <option value="multi-select">Multi-Select</option>
            <option value="rating">Rating</option>
          </select>
        </div>
        {newQ.type === 'multi-select' && (
          <div>
            <label className="block font-medium mb-1">Options</label>
            {(newQ.options || []).map((opt, idx) => (
              <input
                key={idx}
                value={opt.label}
                onChange={e => handleOptionChange(idx, e.target.value)}
                className="border rounded px-3 py-2 w-full mb-2"
                placeholder={`Option ${idx + 1}`}
                required
              />
            ))}
            <button type="button" onClick={addOption} className="bg-gray-200 px-3 py-1 rounded mt-1">Add Option</button>
          </div>
        )}
        <button type="submit" className="bg-orange-500 text-white px-6 py-2 rounded font-bold shadow" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Question'}
        </button>
        {error && <div className="text-red-600">{error}</div>}
      </form>

      <h2 className="text-xl font-semibold mb-2">Existing Questions</h2>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <ul className="divide-y">
          {questions.map(q => (
            <li key={q.id} className="py-3">
              <div className="font-bold">{q.label} <span className="text-xs text-gray-400">({q.slug})</span></div>
              <div className="text-sm text-gray-600">Type: {q.type}</div>
              {q.type === 'multi-select' && (
                <div className="text-sm">Options: {(q.options || []).map((opt: any) => opt.label).join(', ')}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
