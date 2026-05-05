import { useAppSelector } from '@/stores/hooks';
import { isEmpty } from 'lodash';

export type UserPermissions = string[];

const useAuth = () => {
  const { userInfo } = useAppSelector((state) => state.user);
  const userPermissions: UserPermissions = userInfo?.funcPermKeys || [];

  const hasPermission = (permission: string) => {
    if (isEmpty(permission)) {
      return true;
    }

    if (userPermissions?.includes(permission)) {
      return true;
    }

    for (const userPermission of userPermissions) {
      const userPermParts = userPermission.split(':');
      const permissionParts = permission.split(':');

      if (userPermParts.length > permissionParts.length) {
        continue;
      }

      let isMatch = true;
      for (let i = 0; i < userPermParts.length; i++) {
        if (userPermParts[i] === '*') {
          break;
        }

        if (userPermParts[i] !== permissionParts[i]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return true;
      }
    }

    return false;
  };



  return { hasPermission };
};

export default useAuth;