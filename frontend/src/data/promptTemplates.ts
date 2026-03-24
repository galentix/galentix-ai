export interface PromptTemplate {
  id: string;
  category: string;
  icon: string; // lucide icon name
  titleKey: string; // i18n key
  descriptionKey: string; // i18n key
  prompt: string; // The actual prompt text (English)
  promptAr: string; // Arabic version
  useRag?: boolean;
  useWebSearch?: boolean;
}

export const promptTemplates: PromptTemplate[] = [
  // Document Analysis
  {
    id: 'summarize',
    category: 'documents',
    icon: 'FileText',
    titleKey: 'templates.summarize',
    descriptionKey: 'templates.summarizeDesc',
    prompt: 'Please summarize the key points from my uploaded documents.',
    promptAr: 'يرجى تلخيص النقاط الرئيسية من مستنداتي المرفوعة.',
    useRag: true,
  },
  {
    id: 'extract',
    category: 'documents',
    icon: 'Search',
    titleKey: 'templates.extract',
    descriptionKey: 'templates.extractDesc',
    prompt: 'Extract all dates, names, and key figures from my documents.',
    promptAr: 'استخرج جميع التواريخ والأسماء والأرقام الرئيسية من مستنداتي.',
    useRag: true,
  },

  // Business
  {
    id: 'email',
    category: 'business',
    icon: 'Mail',
    titleKey: 'templates.draftEmail',
    descriptionKey: 'templates.draftEmailDesc',
    prompt: 'Help me draft a professional email about: ',
    promptAr: 'ساعدني في صياغة بريد إلكتروني احترافي حول: ',
  },
  {
    id: 'meeting',
    category: 'business',
    icon: 'Calendar',
    titleKey: 'templates.meetingNotes',
    descriptionKey: 'templates.meetingNotesDesc',
    prompt: 'Help me organize these meeting notes into action items: ',
    promptAr: 'ساعدني في تنظيم ملاحظات الاجتماع إلى بنود عمل: ',
  },

  // Translation
  {
    id: 'translate_ar',
    category: 'translation',
    icon: 'Languages',
    titleKey: 'templates.translateAr',
    descriptionKey: 'templates.translateArDesc',
    prompt: 'Translate the following text to Arabic: ',
    promptAr: 'ترجم النص التالي إلى العربية: ',
  },
  {
    id: 'translate_en',
    category: 'translation',
    icon: 'Languages',
    titleKey: 'templates.translateEn',
    descriptionKey: 'templates.translateEnDesc',
    prompt: 'Translate the following text to English: ',
    promptAr: 'ترجم النص التالي إلى الإنجليزية: ',
  },

  // Analysis
  {
    id: 'compare',
    category: 'analysis',
    icon: 'GitCompare',
    titleKey: 'templates.compare',
    descriptionKey: 'templates.compareDesc',
    prompt: 'Compare and contrast the following: ',
    promptAr: 'قارن بين ما يلي: ',
    useRag: true,
  },

  // Research
  {
    id: 'webSearch',
    category: 'research',
    icon: 'Globe',
    titleKey: 'templates.webResearch',
    descriptionKey: 'templates.webResearchDesc',
    prompt: 'Search the web and summarize the latest information about: ',
    promptAr: 'ابحث في الإنترنت ولخص أحدث المعلومات حول: ',
    useWebSearch: true,
  },
];

export const templateCategories = [
  'documents',
  'business',
  'translation',
  'analysis',
  'research',
];
