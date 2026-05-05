import React, { useEffect, useRef, useState } from 'react';
import { Upload } from '@arco-design/web-react';
import ImageCropperModal from '../../ImageCropperModal';
import { uploadFile } from '@/services';
import { getFullFileUrl } from '@/utils/fileUrl';

function ImageUpload({
  defaultFileList,
  config,
  onChange,
}) {
  const [fileList, setFileList] = useState([]);
  const ImageCropperModalRef = useRef(null);

  const upload = async (originFile: File, uploadItem) => {
    const formData = new FormData();
    formData.append('file', originFile);
    try {
      const { fileId, fileUrl } = (await uploadFile(formData)) as Record<
        string,
        any
      >;
      uploadItem.status = 'done';
      uploadItem.url = getFullFileUrl(fileUrl);
      uploadItem.uid = fileId;
      setFileList([...fileList, uploadItem]);
    } catch {
      setFileList(fileList.filter((file) => file.uid !== uploadItem.uid));
    }
  };

  useEffect(() => {
    setFileList(defaultFileList);
  }, [defaultFileList]);

  useEffect(() => {
    onChange(
      fileList.filter((file) => file.status === 'done').map((file) => file.uid)
    );
  }, [fileList]);

  return (
    <>
      <Upload
        imagePreview
        listType="picture-card"
        fileList={fileList}
        multiple={config.multiple}
        limit={config.limit}
        accept="image/*"
        tip={config.tip}
        onChange={(fileList) => {
          if (config.needCrop) {
            return;
          }
        }}
        onRemove={(removeFile) => {
          setFileList(fileList.filter((file) => file.uid !== removeFile.uid));
        }}
        customRequest={({ onError, onSuccess, file }) => {
          if (config.needCrop) {
            ImageCropperModalRef.current.open(file);
          }
        }}
      />

      <ImageCropperModal
        onFinish={(croppedImage) => {
          setFileList([...fileList, croppedImage]);
          upload(croppedImage.originFile, croppedImage);
        }}
        ref={ImageCropperModalRef}
      />
    </>
  );
}

export default ImageUpload;
