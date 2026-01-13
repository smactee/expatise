import AllQuestionsClient from './AllQuestionsClient.client';
import RequirePremium from '@/components/RequirePremium.client';


export default function QuestionsPage() {
  return (
    <RequirePremium>
      <AllQuestionsClient datasetId="cn-2023-test1" />
    </RequirePremium>
  );
}
