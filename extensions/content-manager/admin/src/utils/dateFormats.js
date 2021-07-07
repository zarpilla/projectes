import { dateFormats as defaultDateFormats } from 'strapi-helper-plugin';

// console.log('defaultDateFormats', defaultDateFormats)
const dateFormats = {
    ...defaultDateFormats,
    // Customize the format by un-commenting the one you wan to override it corresponds to the type of your field
    // date: 'dddd, MMMM Do YYYY',
    // datetime: 'dddd, MMMM Do YYYY HH:mm',
    // time: 'HH:mm A',
    // timestamp: 'dddd, MMMM Do YYYY HH:mm',
    // date: 'DD/MM/YYYY',
    // datetime: 'DD/MM/YYYY HH:mm',
    // timestamp: "DD/MM/YYYY HH:mm"
};
// console.log('dateFormats', dateFormats)

export default dateFormats;