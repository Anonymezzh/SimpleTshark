export const getFullFileUrl = (url: string | number) =>
  url ? `${process.env.REACT_APP_HOST ?? ''}/fileShow/${url}` : '';
