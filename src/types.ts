export interface VariantQuestion {
  question: string;
  answer: string;
  analysis: string;
}

export interface QuestionRecord {
  id?: string;
  userId: string;
  originalImageUrl?: string;
  originalText: string;
  knowledgePoint: string;
  variants: VariantQuestion[];
  createdAt: any;
}
