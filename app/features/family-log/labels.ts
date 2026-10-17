import type { LangCode } from '@/lib/language-fonts';

export type FamilyLogLabels = {
  checkin: string;
  route: string;
  routeStop: string;
  recent: string;
  day: string;
  month: string;
  year: string;
  empty: string;
  selectGroup: string;
  loading: string;
  recording: string;
  save: string;
  cancel: string;
  edit: string;
  close: string;
  editTitle: string;
  locationFailed: string;
  saveFailed: string;
  delete: string;
  deleteConfirm: string;
  deletePhotoConfirm: string;
  deleteFailed: string;
  loadFailed: string;
  widgetTitle: string;
  addDaily: string;
  addDailyTitle: string;
  note: string;
  mood: string;
  photos: string;
  photosUploading: string;
  saveDisabledUploading: string;
  saveDisabledSaving: string;
  expense: string;
  receipt: string;
  mapLabel: string;
  mapAdd: string;
  mapRemove: string;
  photoStyle: string;
  photoStyleFilm: string;
  photoStylePostal: string;
  rating: string;
  revisit: string;
  receiptUpload: string;
  receiptNeedExpense: string;
  photosAlbum: string;
  photosAlbumEmpty: string;
  photosAlbumAdd: string;
  currencyRequired: string;
  uploadFailed: string;
};

const ko: FamilyLogLabels = {
  checkin: '내 위치 기록',
  route: '내 루트 기록',
  routeStop: '루트 끝내기',
  recent: '기본',
  day: '일',
  month: '월',
  year: '연',
  empty: '아직 기록이 없습니다.',
  selectGroup: '그룹을 선택해 주세요.',
  loading: '불러오는 중…',
  recording: '경로 기록 중…',
  save: '저장',
  cancel: '취소',
  edit: '편집',
  close: '닫기',
  editTitle: '제목',
  locationFailed: '위치를 가져오지 못했습니다.',
  saveFailed: '저장하지 못했습니다.',
  delete: '삭제',
  deleteConfirm: '이 기록을 삭제할까요?',
  deletePhotoConfirm: '이 사진을 삭제할까요?',
  deleteFailed: '삭제하지 못했습니다.',
  loadFailed: '기록을 불러오지 못했습니다.',
  widgetTitle: '가족 로그',
  addDaily: '일상추가',
  addDailyTitle: '새 일상',
  note: '메모',
  mood: '기분',
  photos: '사진',
  photosUploading: '업로드 중…',
  saveDisabledUploading: '사진을 올리는 중에는 저장할 수 없습니다.',
  saveDisabledSaving: '저장하는 중입니다.',
  expense: '경비',
  receipt: '영수증',
  mapLabel: '지도',
  mapAdd: '지도 넣기',
  mapRemove: '지도 빼기',
  photoStyle: '사진 스타일',
  photoStyleFilm: '필름 조각',
  photoStylePostal: '우편 앨범',
  rating: '별점',
  revisit: '다시 가고 싶어요',
  receiptUpload: '영수증 업로드',
  receiptNeedExpense: '경비 금액을 넣어 주세요.',
  photosAlbum: '가족 앨범',
  photosAlbumEmpty: '가족 앨범에 고를 사진이 없습니다.',
  photosAlbumAdd: '추가',
  currencyRequired: '통화를 선택해 주세요.',
  uploadFailed: '파일을 올리지 못했습니다.',
};

const en: FamilyLogLabels = {
  checkin: 'Log my location',
  route: 'Log my route',
  routeStop: 'Finish route',
  recent: 'Latest',
  day: 'Day',
  month: 'Month',
  year: 'Year',
  empty: 'No logs yet.',
  selectGroup: 'Select a group.',
  loading: 'Loading…',
  recording: 'Recording route…',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  close: 'Close',
  editTitle: 'Title',
  locationFailed: 'Could not read your location.',
  saveFailed: 'Could not save.',
  delete: 'Delete',
  deleteConfirm: 'Delete this log?',
  deletePhotoConfirm: 'Delete this photo?',
  deleteFailed: 'Could not delete.',
  loadFailed: 'Could not load logs.',
  widgetTitle: 'Family Log',
  addDaily: 'Add daily',
  addDailyTitle: 'New daily log',
  note: 'Note',
  mood: 'Mood',
  photos: 'Photos',
  photosUploading: 'Uploading…',
  saveDisabledUploading: 'Saving is unavailable while photos are uploading.',
  saveDisabledSaving: 'Saving…',
  expense: 'Expense',
  receipt: 'Receipt',
  mapLabel: 'Map',
  mapAdd: 'Add map',
  mapRemove: 'Remove map',
  photoStyle: 'Photo style',
  photoStyleFilm: 'Film strips',
  photoStylePostal: 'Postal album',
  rating: 'Rating',
  revisit: 'Want to revisit',
  receiptUpload: 'Upload receipt',
  receiptNeedExpense: 'Enter the expense amount first.',
  photosAlbum: 'Family album',
  photosAlbumEmpty: 'No photos available in the family album.',
  photosAlbumAdd: 'Add',
  currencyRequired: 'Choose a currency.',
  uploadFailed: 'Could not upload the file.',
};

const ja: FamilyLogLabels = {
  ...en,
  widgetTitle: 'ファミリーログ',
  addDaily: '日常を追加',
  addDailyTitle: '新しい日常',
  note: 'メモ',
  mood: '気分',
  photos: '写真',
  photosUploading: 'アップロード中…',
  saveDisabledUploading: '写真のアップロード中は保存できません。',
  saveDisabledSaving: '保存しています。',
  expense: '費用',
  receipt: 'レシート',
  mapLabel: '地図',
  mapAdd: '地図を入れる',
  mapRemove: '地図を外す',
  photoStyle: '写真スタイル',
  photoStyleFilm: 'フィルム',
  photoStylePostal: '郵便アルバム',
  rating: '評価',
  revisit: 'また行きたい',
  receiptUpload: '領収書アップロード',
  receiptNeedExpense: '費用の金額を入力してください。',
  photosAlbum: '家族アルバム',
  photosAlbumEmpty: '家族アルバムに選べる写真がありません。',
  photosAlbumAdd: '追加',
  currencyRequired: '通貨を選んでください。',
  uploadFailed: 'アップロードできませんでした。',
  checkin: '現在地を記録',
  route: 'ルートを記録',
  routeStop: 'ルート終了',
  recent: '最新',
  day: '日',
  month: '月',
  year: '年',
  empty: 'まだ記録がありません。',
  selectGroup: 'グループを選んでください。',
  loading: '読み込み中…',
  recording: 'ルート記録中…',
  save: '保存',
  cancel: 'キャンセル',
  edit: '編集',
  close: '閉じる',
  editTitle: 'タイトル',
  locationFailed: '位置を取得できませんでした。',
  saveFailed: '保存できませんでした。',
  delete: '削除',
  deleteConfirm: 'この記録を削除しますか？',
  deletePhotoConfirm: 'この写真を削除しますか？',
  deleteFailed: '削除できませんでした。',
};

const zhCN: FamilyLogLabels = {
  ...en,
  widgetTitle: '家庭日志',
  addDaily: '添加日常',
  addDailyTitle: '新的日常',
  note: '备注',
  mood: '心情',
  photos: '照片',
  photosUploading: '上传中…',
  saveDisabledUploading: '照片上传时无法保存。',
  saveDisabledSaving: '正在保存。',
  expense: '花费',
  receipt: '收据',
  mapLabel: '地图',
  mapAdd: '加入地图',
  mapRemove: '移除地图',
  photoStyle: '照片样式',
  photoStyleFilm: '胶片',
  photoStylePostal: '邮册',
  rating: '评分',
  revisit: '想再去',
  receiptUpload: '上传收据',
  receiptNeedExpense: '请先输入花费金额。',
  photosAlbum: '家庭相册',
  photosAlbumEmpty: '家庭相册中没有可选照片。',
  photosAlbumAdd: '添加',
  currencyRequired: '请选择货币。',
  uploadFailed: '上传失败。',
  checkin: '记录我的位置',
  route: '记录我的路线',
  routeStop: '结束路线',
  recent: '最新',
  day: '日',
  month: '月',
  year: '年',
  empty: '还没有记录。',
  selectGroup: '请选择小组。',
  loading: '加载中…',
  recording: '正在记录路线…',
  save: '保存',
  cancel: '取消',
  edit: '编辑',
  close: '关闭',
  editTitle: '标题',
  locationFailed: '无法获取位置。',
  saveFailed: '保存失败。',
  delete: '删除',
  deleteConfirm: '要删除这条记录吗？',
  deletePhotoConfirm: '要删除这张照片吗？',
  deleteFailed: '删除失败。',
};

const zhTW: FamilyLogLabels = {
  ...zhCN,
  widgetTitle: '家庭日誌',
  addDaily: '新增日常',
  addDailyTitle: '新的日常',
  note: '備註',
  photos: '照片',
  photosUploading: '上傳中…',
  saveDisabledUploading: '照片上傳時無法儲存。',
  saveDisabledSaving: '正在儲存。',
  expense: '花費',
  receipt: '收據',
  mapLabel: '地圖',
  mapAdd: '加入地圖',
  mapRemove: '移除地圖',
  photoStyle: '照片樣式',
  photoStyleFilm: '膠片',
  photoStylePostal: '郵冊',
  rating: '評分',
  revisit: '想再去',
  receiptUpload: '上傳收據',
  receiptNeedExpense: '請先輸入花費金額。',
  photosAlbum: '家庭相簿',
  photosAlbumEmpty: '家庭相簿中沒有可選照片。',
  photosAlbumAdd: '新增',
  currencyRequired: '請選擇貨幣。',
  uploadFailed: '上傳失敗。',
  checkin: '記錄我的位置',
  route: '記錄我的路線',
  routeStop: '結束路線',
  recent: '最新',
  empty: '還沒有記錄。',
  selectGroup: '請選擇小組。',
  loading: '載入中…',
  recording: '正在記錄路線…',
  save: '儲存',
  edit: '編輯',
  close: '關閉',
  editTitle: '標題',
  locationFailed: '無法取得位置。',
  saveFailed: '儲存失敗。',
  delete: '刪除',
  deleteConfirm: '要刪除這筆記錄嗎？',
  deletePhotoConfirm: '要刪除這張照片嗎？',
  deleteFailed: '刪除失敗。',
};

const es: FamilyLogLabels = {
  ...en,
  widgetTitle: 'Diario familiar',
  addDaily: 'Añadir día',
  addDailyTitle: 'Nuevo día',
  note: 'Nota',
  mood: 'Ánimo',
  photos: 'Fotos',
  photosUploading: 'Subiendo…',
  saveDisabledUploading: 'No se puede guardar mientras se suben las fotos.',
  saveDisabledSaving: 'Guardando…',
  expense: 'Gasto',
  receipt: 'Recibo',
  mapLabel: 'Mapa',
  mapAdd: 'Añadir mapa',
  mapRemove: 'Quitar mapa',
  photoStyle: 'Estilo de fotos',
  photoStyleFilm: 'Tiras de film',
  photoStylePostal: 'Álbum postal',
  rating: 'Clasificación',
  revisit: 'Quiero volver',
  receiptUpload: 'Subir recibo',
  receiptNeedExpense: 'Introduce primero el importe del gasto.',
  photosAlbum: 'Álbum familiar',
  photosAlbumEmpty: 'No hay fotos en el álbum familiar.',
  photosAlbumAdd: 'Añadir',
  currencyRequired: 'Elige una moneda.',
  uploadFailed: 'No se pudo subir el archivo.',
  checkin: 'Registrar mi ubicación',
  route: 'Registrar mi ruta',
  routeStop: 'Terminar ruta',
  recent: 'Recientes',
  day: 'Día',
  month: 'Mes',
  year: 'Año',
  empty: 'Aún no hay registros.',
  selectGroup: 'Elige un grupo.',
  loading: 'Cargando…',
  recording: 'Grabando ruta…',
  save: 'Guardar',
  cancel: 'Cancelar',
  edit: 'Editar',
  close: 'Cerrar',
  editTitle: 'Título',
  locationFailed: 'No se pudo leer la ubicación.',
  saveFailed: 'No se pudo guardar.',
  delete: 'Eliminar',
  deleteConfirm: '¿Eliminar este registro?',
  deletePhotoConfirm: '¿Eliminar esta foto?',
  deleteFailed: 'No se pudo eliminar.',
};

const fr: FamilyLogLabels = {
  ...en,
  widgetTitle: 'Journal familial',
  addDaily: 'Ajouter',
  addDailyTitle: 'Nouveau jour',
  note: 'Note',
  mood: 'Humeur',
  photos: 'Photos',
  photosUploading: 'Envoi…',
  saveDisabledUploading: 'Enregistrement indisponible pendant l’envoi des photos.',
  saveDisabledSaving: 'Enregistrement…',
  expense: 'Dépense',
  receipt: 'Reçu',
  mapLabel: 'Carte',
  mapAdd: 'Ajouter la carte',
  mapRemove: 'Retirer la carte',
  photoStyle: 'Style des photos',
  photoStyleFilm: 'Pellicule',
  photoStylePostal: 'Album postal',
  rating: 'Notation',
  revisit: 'Envie de revoir',
  receiptUpload: 'Téléverser un reçu',
  receiptNeedExpense: 'Saisissez d’abord le montant de la dépense.',
  photosAlbum: 'Album famille',
  photosAlbumEmpty: 'Aucune photo dans l’album famille.',
  photosAlbumAdd: 'Ajouter',
  currencyRequired: 'Choisissez une devise.',
  uploadFailed: 'Envoi impossible.',
  checkin: 'Noter ma position',
  route: 'Noter mon trajet',
  routeStop: 'Terminer le trajet',
  recent: 'Récents',
  day: 'Jour',
  month: 'Mois',
  year: 'Année',
  empty: 'Aucun journal pour le moment.',
  selectGroup: 'Choisissez un groupe.',
  loading: 'Chargement…',
  recording: 'Trajet en cours…',
  save: 'Enregistrer',
  cancel: 'Annuler',
  edit: 'Modifier',
  close: 'Fermer',
  editTitle: 'Titre',
  locationFailed: 'Position indisponible.',
  saveFailed: 'Enregistrement impossible.',
  delete: 'Supprimer',
  deleteConfirm: 'Supprimer cette note ?',
  deletePhotoConfirm: 'Supprimer cette photo ?',
  deleteFailed: 'Suppression impossible.',
};

const de: FamilyLogLabels = {
  ...en,
  widgetTitle: 'Familientagebuch',
  addDaily: 'Tag hinzufügen',
  addDailyTitle: 'Neuer Tag',
  note: 'Notiz',
  mood: 'Stimmung',
  photos: 'Fotos',
  photosUploading: 'Wird hochgeladen…',
  saveDisabledUploading: 'Speichern ist während des Foto-Uploads nicht möglich.',
  saveDisabledSaving: 'Wird gespeichert…',
  expense: 'Ausgabe',
  receipt: 'Beleg',
  mapLabel: 'Karte',
  mapAdd: 'Karte hinzufügen',
  mapRemove: 'Karte entfernen',
  photoStyle: 'Fotostil',
  photoStyleFilm: 'Filmstreifen',
  photoStylePostal: 'Postalbum',
  rating: 'Bewertung',
  revisit: 'Möchte es noch einmal besuchen',
  receiptUpload: 'Beleg hochladen',
  receiptNeedExpense: 'Bitte zuerst den Ausgabenbetrag eingeben.',
  photosAlbum: 'Familienalbum',
  photosAlbumEmpty: 'Keine Fotos im Familienalbum.',
  photosAlbumAdd: 'Hinzufügen',
  currencyRequired: 'Währung wählen.',
  uploadFailed: 'Hochladen fehlgeschlagen.',
  checkin: 'Standort speichern',
  route: 'Route speichern',
  routeStop: 'Route beenden',
  recent: 'Neueste',
  day: 'Tag',
  month: 'Monat',
  year: 'Jahr',
  empty: 'Noch keine Einträge.',
  selectGroup: 'Bitte eine Gruppe wählen.',
  loading: 'Laden…',
  recording: 'Route wird aufgezeichnet…',
  save: 'Speichern',
  cancel: 'Abbrechen',
  edit: 'Bearbeiten',
  close: 'Schließen',
  editTitle: 'Titel',
  locationFailed: 'Standort nicht verfügbar.',
  saveFailed: 'Speichern fehlgeschlagen.',
  delete: 'Löschen',
  deleteConfirm: 'Diesen Eintrag löschen?',
  deletePhotoConfirm: 'Dieses Foto löschen?',
  deleteFailed: 'Löschen fehlgeschlagen.',
};

const it: FamilyLogLabels = {
  ...en,
  widgetTitle: 'Diario di famiglia',
  addDaily: 'Aggiungi giorno',
  addDailyTitle: 'Nuovo giorno',
  note: 'Nota',
  mood: 'Umore',
  photos: 'Foto',
  photosUploading: 'Caricamento…',
  saveDisabledUploading: 'Non è possibile salvare mentre le foto vengono caricate.',
  saveDisabledSaving: 'Salvataggio…',
  expense: 'Spesa',
  receipt: 'Scontrino',
  mapLabel: 'Mappa',
  mapAdd: 'Aggiungi mappa',
  mapRemove: 'Rimuovi mappa',
  photoStyle: 'Stile foto',
  photoStyleFilm: 'Pellicola',
  photoStylePostal: 'Album postale',
  rating: 'Valutazione',
  revisit: 'Vuoi rivisitare',
  receiptUpload: 'Carica ricevuta',
  receiptNeedExpense: 'Inserisci prima l’importo della spesa.',
  photosAlbum: 'Album di famiglia',
  photosAlbumEmpty: 'Nessuna foto nell’album di famiglia.',
  photosAlbumAdd: 'Aggiungi',
  currencyRequired: 'Scegli una valuta.',
  uploadFailed: 'Caricamento non riuscito.',
  checkin: 'Registra la posizione',
  route: 'Registra il percorso',
  routeStop: 'Termina percorso',
  recent: 'Recenti',
  day: 'Giorno',
  month: 'Mese',
  year: 'Anno',
  empty: 'Nessuna nota ancora.',
  selectGroup: 'Scegli un gruppo.',
  loading: 'Caricamento…',
  recording: 'Registrazione percorso…',
  save: 'Salva',
  cancel: 'Annulla',
  edit: 'Modifica',
  close: 'Chiudi',
  editTitle: 'Titolo',
  locationFailed: 'Posizione non disponibile.',
  saveFailed: 'Salvataggio non riuscito.',
  delete: 'Elimina',
  deleteConfirm: 'Eliminare questa nota?',
  deletePhotoConfirm: 'Eliminare questa foto?',
  deleteFailed: 'Eliminazione non riuscita.',
};

const pt: FamilyLogLabels = {
  ...en,
  widgetTitle: 'Diário da família',
  addDaily: 'Adicionar dia',
  addDailyTitle: 'Novo dia',
  note: 'Nota',
  mood: 'Humor',
  photos: 'Fotos',
  photosUploading: 'Enviando…',
  saveDisabledUploading: 'Não é possível salvar enquanto as fotos são enviadas.',
  saveDisabledSaving: 'Salvando…',
  expense: 'Despesa',
  receipt: 'Recibo',
  mapLabel: 'Mapa',
  mapAdd: 'Adicionar mapa',
  mapRemove: 'Remover mapa',
  photoStyle: 'Estilo das fotos',
  photoStyleFilm: 'Filme',
  photoStylePostal: 'Álbum postal',
  rating: 'Avaliação',
  revisit: 'Quero voltar',
  receiptUpload: 'Enviar recibo',
  receiptNeedExpense: 'Insira primeiro o valor do gasto.',
  photosAlbum: 'Álbum da família',
  photosAlbumEmpty: 'Não há fotos no álbum da família.',
  photosAlbumAdd: 'Adicionar',
  currencyRequired: 'Escolha uma moeda.',
  uploadFailed: 'Não foi possível enviar.',
  checkin: 'Registar a minha localização',
  route: 'Registar a minha rota',
  routeStop: 'Terminar rota',
  recent: 'Recentes',
  day: 'Dia',
  month: 'Mês',
  year: 'Ano',
  empty: 'Ainda não há registos.',
  selectGroup: 'Escolha um grupo.',
  loading: 'A carregar…',
  recording: 'A gravar a rota…',
  save: 'Guardar',
  cancel: 'Cancelar',
  edit: 'Editar',
  close: 'Fechar',
  editTitle: 'Título',
  locationFailed: 'Não foi possível ler a localização.',
  saveFailed: 'Não foi possível guardar.',
  delete: 'Excluir',
  deleteConfirm: 'Excluir este registro?',
  deletePhotoConfirm: 'Excluir esta foto?',
  deleteFailed: 'Não foi possível excluir.',
};

const LABELS: Record<LangCode, FamilyLogLabels> = {
  ko,
  en,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  es,
  fr,
  de,
  it,
  pt,
};

export function getFamilyLogLabels(lang: LangCode): FamilyLogLabels {
  return LABELS[lang] ?? en;
}

export function familyLogCheckinFallback(lang: LangCode, hm: string): string {
  const clock = hm.trim().substring(0, 5);
  switch (lang) {
    case 'ko':
      return clock ? `위치 기록 ${clock}` : '위치 기록';
    case 'ja':
      return clock ? `位置記録 ${clock}` : '位置記録';
    case 'zh-CN':
      return clock ? `位置记录 ${clock}` : '位置记录';
    case 'zh-TW':
      return clock ? `位置記錄 ${clock}` : '位置記錄';
    case 'es':
      return clock ? `Ubicación ${clock}` : 'Ubicación';
    case 'fr':
      return clock ? `Position ${clock}` : 'Position';
    case 'de':
      return clock ? `Standort ${clock}` : 'Standort';
    case 'it':
      return clock ? `Posizione ${clock}` : 'Posizione';
    case 'pt':
      return clock ? `Local ${clock}` : 'Local';
    default:
      return clock ? `Location ${clock}` : 'Location';
  }
}

export function familyLogRouteTitle(lang: LangCode, startHm: string, endHm: string): string {
  const start = startHm.trim().substring(0, 5);
  const end = endHm.trim().substring(0, 5);
  const span = start && end && end !== start ? `${start}–${end}` : start;
  switch (lang) {
    case 'ko':
      return span ? `경로 기록 ${span}` : '경로 기록';
    case 'ja':
      return span ? `ルート記録 ${span}` : 'ルート記録';
    case 'zh-CN':
      return span ? `路线记录 ${span}` : '路线记录';
    case 'zh-TW':
      return span ? `路線記錄 ${span}` : '路線記錄';
    case 'es':
      return span ? `Ruta ${span}` : 'Ruta';
    case 'fr':
      return span ? `Trajet ${span}` : 'Trajet';
    case 'de':
      return span ? `Route ${span}` : 'Route';
    case 'it':
      return span ? `Percorso ${span}` : 'Percorso';
    case 'pt':
      return span ? `Rota ${span}` : 'Rota';
    default:
      return span ? `Route ${span}` : 'Route';
  }
}
