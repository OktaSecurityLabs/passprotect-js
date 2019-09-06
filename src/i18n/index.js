import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { pt, en } from './locales';

const options = {
  interpolation: {
    escapeValue: false, // not needed for react!!
  },

  debug: true,

  // lng: 'en',

  resources: {
    pt: {
      common: pt['pt-BR'],
    },
    en: {
      common: en.en,
    },
  },
  joinArrays: '',
  fallbackLng: 'en',

  ns: ['common'],

  defaultNS: 'common',

};

i18n
  .use(LanguageDetector)
  .init(options);

export default i18n;
