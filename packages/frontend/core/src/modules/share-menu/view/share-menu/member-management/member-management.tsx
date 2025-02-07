import { Skeleton } from '@affine/component';
import {
  DocGrantedUsersService,
  type GrantedUser,
} from '@affine/core/modules/permissions';
import { useI18n } from '@affine/i18n';
import { ArrowLeftBigIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { Scroller } from '../scroller';
import { MemberItem } from './member-item';
import * as styles from './member-management.css';

export const MemberManagement = ({
  openPaywallModal,
  hittingPaywall,
  onClickBack,
  onClickInvite,
}: {
  hittingPaywall: boolean;
  openPaywallModal: () => void;
  onClickBack: () => void;
  onClickInvite: () => void;
}) => {
  const docGrantedUsersService = useService(DocGrantedUsersService);

  const grantedUserList = useLiveData(docGrantedUsersService.grantedUsers$);
  const grantedUserCount = useLiveData(
    docGrantedUsersService.grantedUserCount$
  );

  const t = useI18n();

  useEffect(() => {
    // reset the list when mounted
    docGrantedUsersService.reset();
    docGrantedUsersService.loadMore();
  }, [docGrantedUsersService]);

  const loadMore = useCallback(() => {
    docGrantedUsersService.loadMore();
  }, [docGrantedUsersService]);

  return (
    <div className={styles.containerStyle}>
      <div className={styles.headerStyle} onClick={onClickBack}>
        <ArrowLeftBigIcon className={styles.iconStyle} />
        {t['com.affine.share-menu.member-management.header']({
          memberCount: grantedUserCount?.toString() || '??',
        })}
      </div>
      {grantedUserList ? (
        <MemberList
          openPaywallModal={openPaywallModal}
          hittingPaywall={hittingPaywall}
          grantedUserList={grantedUserList}
          grantedUserCount={grantedUserCount}
          loadMore={loadMore}
        />
      ) : (
        <Skeleton className={styles.scrollableRootStyle} />
      )}
      {/* TODO(@eyhn): add guard here */}
      <div className={styles.footerStyle}>
        <span className={styles.addCollaboratorsStyle} onClick={onClickInvite}>
          {t['com.affine.share-menu.member-management.add-collaborators']()}
        </span>
      </div>
    </div>
  );
};

const MemberList = ({
  openPaywallModal,
  hittingPaywall,
  grantedUserList,
  grantedUserCount,
  loadMore,
}: {
  hittingPaywall: boolean;
  grantedUserList: GrantedUser[];
  grantedUserCount?: number;
  openPaywallModal: () => void;
  loadMore: () => void;
}) => {
  const itemContentRenderer = useCallback(
    (_index: number, data: GrantedUser) => {
      return (
        <MemberItem
          key={data.user.id}
          grantedUser={data}
          openPaywallModal={openPaywallModal}
          hittingPaywall={hittingPaywall}
        />
      );
    },
    [hittingPaywall, openPaywallModal]
  );
  return (
    <Virtuoso
      components={{
        Scroller,
      }}
      data={grantedUserList}
      itemContent={itemContentRenderer}
      totalCount={grantedUserCount}
      endReached={loadMore}
    />
  );
};
