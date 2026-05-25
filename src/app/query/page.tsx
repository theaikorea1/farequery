import QueryInterface from '@/components/QueryInterface';

export default function QueryPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">운임 조회</h1>
        <p className="text-sm text-gray-500 mt-1">
          분류·권역·도시·기간으로 필터링하여 운임 이력을 조회합니다.
        </p>
      </div>
      <QueryInterface />
    </div>
  );
}
