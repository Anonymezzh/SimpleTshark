import { isEmpty } from 'lodash';

export type UserPermission = string[];

type Auth = {
  resource: string;
  actions?: string[];
};

export interface AuthParams {
  requiredPermissions?: Array<Auth>;
  oneOfPerm?: boolean;
  permission? : string
}

export default (permission, userPermission: UserPermission) => {
  if (isEmpty(permission)) {
    return true;
  }
  return userPermission?.includes(permission)
};
