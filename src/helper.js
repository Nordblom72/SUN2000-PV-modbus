
const convertFromUtcToLocalDate = (utcDateObj) => {
  const offset = utcDateObj.getTimezoneOffset();
  return new Date(utcDateObj.getTime() - offset * 60000);
}
const monthsAsTextList = ['January', 'February', 'Mars', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const numDaysInMonth = (year, month) => convertFromUtcToLocalDate(new Date(year, month, 0)).getDate();



module.exports = { convertFromUtcToLocalDate, monthsAsTextList, numDaysInMonth }