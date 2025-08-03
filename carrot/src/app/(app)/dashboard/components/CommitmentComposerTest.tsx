import CommitmentComposer from './CommitmentComposer';

export default function CommitmentComposerTest() {
  return (
    <div className="w-[320px] sm:w-[480px] md:w-[600px] border-2 border-red-500 mx-auto mt-10 p-2 bg-white">
      <CommitmentComposer onSubmit={() => {}} />
    </div>
  );
}
