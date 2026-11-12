import { toast } from '@/hooks/use-toast';
import { Select } from '@/components/ui/select';

  // Download CSV template
export function downloadCSVTemplate() {
    const csvContent = `QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Points,Instructions,SampleAnswer
"What is 2 + 2?",multiple_choice,"2","3","4","5","C",1,"Choose the correct answer","4"
"What is the capital of France?",multiple_choice,"London","Paris","Berlin","Madrid","B",1,"Select the correct capital city","Paris"
"Read the passage below and answer the question that follows.

The sun rose slowly over the quiet village, casting long shadows across the dusty road.

According to the passage, when did the sun rise?",multiple_choice,"At noon","Slowly, over the village","At midnight","During a storm","B",2,"This shows a multi-line reading passage can be pasted directly into one quoted cell",""
"Explain what a Control Account is and state five advantages.",essay,"","","","","",15,"Write a detailed explanation showing your understanding of control accounts and their benefits in accounting","A Control Account is a summary account that shows the total balance of a subsidiary ledger. Advantages include: 1) Error detection 2) Time saving 3) Fraud prevention 4) Quick trial balance 5) Management control"
"Define Partnership Deed and explain its importance.",essay,"","","","","",10,"Provide definition and explain why it's important in partnerships","A Partnership Deed is a legal document that outlines the terms and conditions of a partnership business..."`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'exam_questions_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Enhanced Template Downloaded",
      description: "CSV template with multiple_choice and essay question types has been downloaded.",
    });
  }
