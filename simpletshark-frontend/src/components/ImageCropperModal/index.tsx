import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Modal } from '@arco-design/web-react';
import { Cropper } from 'react-cropper';
import 'cropperjs/dist/cropper.css';

const ImageCropperModal = forwardRef(
  (
    props: {
      onFinish: (values: Record<string, any>) => void;
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const cropperRef = useRef(null);
    const [originImageFile, setOriginImageFile] = useState(null);
    const [imageSrc, setImageSrc] = useState(null);

    useImperativeHandle(
      ref,
      () => {
        return {
          open: (imageFile: File) => {
            setOriginImageFile(imageFile);
            setVisible(true);
            const reader = new FileReader();
            reader.onload = () => {
              setImageSrc(reader.result as any);
            };
            reader.readAsDataURL(imageFile);
          },
        };
      },
      []
    );

    const handleFinish = () => {
      cropperRef.current?.cropper.getCroppedCanvas().toBlob(async (blob) => {
        const file = new File([blob], originImageFile.name);
        setVisible(false);
        props.onFinish({
          originFile: file,
          name: originImageFile.name,
          uid: Date.now(),
          status: 'uploading'
        });
      });
    };

    const handleCancel = () => {
      setVisible(false);
      setTimeout(() => {
        setImageSrc(null);
      }, 300);
    };

    return (
      <Modal
        title="裁剪图片"
        visible={visible}
        onOk={handleFinish}
        onCancel={handleCancel}
      >
        <Cropper
          ref={cropperRef}
          style={{ height: 400, width: '100%' }}
          zoomTo={0.5}
          initialAspectRatio={1}
          src={imageSrc}
          viewMode={1}
          minCropBoxHeight={100}
          minCropBoxWidth={100}
          background={false}
          responsive={true}
          autoCropArea={1}
          checkOrientation={false}
          guides={true}
        />
      </Modal>
    );
  }
);

export default ImageCropperModal;
