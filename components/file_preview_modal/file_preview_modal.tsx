// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';

import {FileInfo} from '@mattermost/types/files';
import {Post} from '@mattermost/types/posts';

import {getFileDownloadUrl, getFilePreviewUrl, getFileUrl} from 'mattermost-redux/utils/file_utils';
import LoadingImagePreview from 'components/loading_image_preview';
import Constants, {FileTypes, ZoomSettings} from 'utils/constants';
import * as Utils from 'utils/utils';
import AudioVideoPreview from 'components/audio_video_preview';
import CodePreview from 'components/code_preview';
import FileInfoPreview from 'components/file_info_preview';

import {FilePreviewComponent} from 'types/store/plugins';

import ImagePreview from './image_preview';
import './file_preview_modal.scss';
import FilePreviewModalFooter from './file_preview_modal_footer/file_preview_modal_footer';
import FilePreviewModalHeader from './file_preview_modal_header/file_preview_modal_header';
import PopoverBar from './popover_bar';
import {LinkInfo, isFileInfo} from './types';

const PDFPreview = React.lazy(() => import('components/pdf_preview'));

const KeyCodes = Constants.KeyCodes;

export type Props = {
    canDownloadFiles: boolean;
    enablePublicLink: boolean;

    /**
     * List of FileInfo to view
     **/
    fileInfos: Array<FileInfo | LinkInfo>;

    isMobileView: boolean;
    pluginFilePreviewComponents: FilePreviewComponent[];
    onExited: () => void;

    /**
     * The id of the post the files are attached to
     */
    postId?: string;

    /**
     * The post the files are attached to
     * Either postId or post can be passed to FilePreviewModal
     */
    post?: Post;

    /**
     * The index number of starting image
     **/
    startIndex: number;
}

type State = {
    show: boolean;
    imageIndex: number;
    imageHeight: number | string;
    loaded: boolean[];
    prevFileInfosCount: number;
    progress: number[];
    showCloseBtn: boolean;
    showZoomControls: boolean;
    scale: number[];
}

export default class FilePreviewModal extends React.PureComponent<Props, State> {
    static defaultProps = {
        fileInfos: [],
        startIndex: 0,
        pluginFilePreviewComponents: [],
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
            imageIndex: this.props.startIndex,
            imageHeight: '100%',
            loaded: Utils.fillArray(false, this.props.fileInfos.length),
            prevFileInfosCount: 0,
            progress: Utils.fillArray(0, this.props.fileInfos.length),
            showCloseBtn: false,
            showZoomControls: false,
            scale: Utils.fillArray(ZoomSettings.DEFAULT_SCALE, this.props.fileInfos.length),
        };
    }

    handleNext = () => {
        let id = this.state.imageIndex + 1;
        if (id > this.props.fileInfos.length - 1) {
            id = 0;
        }
        this.showImage(id);
    }

    handlePrev = () => {
        let id = this.state.imageIndex - 1;
        if (id < 0) {
            id = this.props.fileInfos.length - 1;
        }
        this.showImage(id);
    }

    handleKeyPress = (e: KeyboardEvent) => {
        if (Utils.isKeyPressed(e, KeyCodes.RIGHT)) {
            this.handleNext();
        } else if (Utils.isKeyPressed(e, KeyCodes.LEFT)) {
            this.handlePrev();
        }
    }

    componentDidMount() {
        document.addEventListener('keyup', this.handleKeyPress);

        this.showImage(this.props.startIndex);
    }

    componentWillUnmount() {
        document.removeEventListener('keyup', this.handleKeyPress);
    }

    static getDerivedStateFromProps(props: Props, state: State) {
        const updatedState: Partial<State> = {};
        if (props.fileInfos[state.imageIndex] && props.fileInfos[state.imageIndex].extension === FileTypes.PDF) {
            updatedState.showZoomControls = true;
        } else {
            updatedState.showZoomControls = false;
        }
        if (props.fileInfos.length !== state.prevFileInfosCount) {
            updatedState.loaded = Utils.fillArray(false, props.fileInfos.length);
            updatedState.progress = Utils.fillArray(0, props.fileInfos.length);
            updatedState.prevFileInfosCount = props.fileInfos.length;
        }
        return Object.keys(updatedState).length ? updatedState : null;
    }

    showImage = (id: number) => {
        this.setState({imageIndex: id});

        const imageHeight = window.innerHeight - 100;
        this.setState({imageHeight});

        if (!this.state.loaded[id]) {
            this.loadImage(id);
        }
    }

    loadImage = (index: number) => {
        const fileInfo = this.props.fileInfos[index];
        const fileType = Utils.getFileType(fileInfo.extension);

        if (fileType === FileTypes.IMAGE && isFileInfo(fileInfo)) {
            let previewUrl;
            if (fileInfo.has_preview_image) {
                previewUrl = getFilePreviewUrl(fileInfo.id);
            } else {
                // some images (eg animated gifs) just show the file itself and not a preview
                previewUrl = getFileUrl(fileInfo.id);
            }

            Utils.loadImage(
                previewUrl,
                () => this.handleImageLoaded(index),
                (completedPercentage) => this.handleImageProgress(index, completedPercentage),
            );
        } else {
            // there's nothing to load for non-image files
            this.handleImageLoaded(index);
        }
    }

    handleImageLoaded = (index: number) => {
        this.setState((prevState) => {
            return {
                loaded: {
                    ...prevState.loaded,
                    [index]: true,
                },
            };
        });
    }

    handleImageProgress = (index: number, completedPercentage: number) => {
        this.setState((prevState) => {
            return {
                progress: {
                    ...prevState.progress,
                    [index]: completedPercentage,
                },
            };
        });
    }

    onMouseEnterImage = () => {
        this.setState({showCloseBtn: true});
    }

    onMouseLeaveImage = () => {
        this.setState({showCloseBtn: false});
    }

    setScale = (index: number, scale: number) => {
        this.setState((prevState) => {
            return {
                scale: {
                    ...prevState.scale,
                    [index]: scale,
                },
            };
        });
    }

    handleZoomIn = () => {
        let newScale = this.state.scale[this.state.imageIndex];
        newScale = Math.min(newScale + ZoomSettings.SCALE_DELTA, ZoomSettings.MAX_SCALE);
        this.setScale(this.state.imageIndex, newScale);
    };

    handleZoomOut = () => {
        let newScale = this.state.scale[this.state.imageIndex];
        newScale = Math.max(newScale - ZoomSettings.SCALE_DELTA, ZoomSettings.MIN_SCALE);
        this.setScale(this.state.imageIndex, newScale);
    };

    handleZoomReset = () => {
        this.setScale(this.state.imageIndex, ZoomSettings.DEFAULT_SCALE);
    }

    handleModalClose = () => {
        this.setState({show: false});
    }

    handleBgClose = (e: React.MouseEvent) => {
        if (e.currentTarget === e.target) {
            this.handleModalClose();
        }
    }

    render() {
        if (this.props.fileInfos.length < 1 || this.props.fileInfos.length - 1 < this.state.imageIndex) {
            return null;
        }

        const fileInfo = this.props.fileInfos[this.state.imageIndex];
        const fileType = Utils.getFileType(fileInfo.extension);

        let showPublicLink;
        let fileName;
        let fileUrl;
        let fileDownloadUrl;
        let isExternalFile;
        if (isFileInfo(fileInfo)) {
            showPublicLink = true;
            fileName = fileInfo.name;
            fileUrl = getFileUrl(fileInfo.id);
            fileDownloadUrl = getFileDownloadUrl(fileInfo.id);
            isExternalFile = false;
        } else {
            showPublicLink = false;
            fileName = fileInfo.name || fileInfo.link;
            fileUrl = fileInfo.link;
            fileDownloadUrl = fileInfo.link;
            isExternalFile = true;
        }

        let dialogClassName = 'a11y__modal modal-image file-preview-modal';

        let content;
        let modalImageClass = '';
        let zoomBar;

        if (this.state.loaded[this.state.imageIndex]) {
            if (fileType === FileTypes.IMAGE || fileType === FileTypes.SVG) {
                content = (
                    <ImagePreview
                        fileInfo={fileInfo}
                        canDownloadFiles={this.props.canDownloadFiles}
                    />
                );
            } else if (fileType === FileTypes.VIDEO || fileType === FileTypes.AUDIO) {
                content = (
                    <AudioVideoPreview
                        fileInfo={fileInfo as FileInfo}
                        fileUrl={fileUrl}
                    />
                );
            } else if (fileType === FileTypes.PDF) {
                modalImageClass = ' file-preview-modal__content-scrollable';
                content = (
                    <div
                        className='file-preview-modal__scrollable'
                        onClick={this.handleBgClose}
                    >
                        <React.Suspense fallback={null}>
                            <PDFPreview
                                fileInfo={fileInfo}
                                fileUrl={fileUrl}
                                scale={this.state.scale[this.state.imageIndex]}
                                handleBgClose={this.handleBgClose}
                            />
                        </React.Suspense>
                    </div>
                );
                zoomBar = (
                    <PopoverBar
                        scale={this.state.scale[this.state.imageIndex]}
                        showZoomControls={this.state.showZoomControls}
                        handleZoomIn={this.handleZoomIn}
                        handleZoomOut={this.handleZoomOut}
                        handleZoomReset={this.handleZoomReset}
                    />
                );
            } else if (CodePreview.supports(fileInfo)) {
                dialogClassName += ' modal-code';
                content = (
                    <CodePreview
                        fileInfo={fileInfo}
                        fileUrl={fileUrl}
                        className='file-preview-modal__code-preview'
                    />
                );
            } else {
                content = (
                    <FileInfoPreview
                        fileInfo={fileInfo as FileInfo}
                        fileUrl={fileUrl}
                    />
                );
            }
        } else {
            // display a progress indicator when the preview for an image is still loading
            const loading = Utils.localizeMessage('view_image.loading', 'Loading');
            const progress = Math.floor(this.state.progress[this.state.imageIndex]);

            content = (
                <LoadingImagePreview
                    loading={loading}
                    progress={progress}
                />
            );
        }

        if (isFileInfo(fileInfo)) {
            for (const preview of this.props.pluginFilePreviewComponents) {
                if (preview.override(fileInfo, this.props.post)) {
                    content = (
                        <preview.component
                            fileInfo={fileInfo}
                            post={this.props.post}
                        />
                    );
                    break;
                }
            }
        }

        return (
            <Modal
                show={this.state.show}
                onHide={this.handleModalClose}
                onExited={this.props.onExited}
                className='modal-image file-preview-modal'
                dialogClassName={dialogClassName}
                animation={true}
                backdrop={false}
                role='dialog'
                style={{paddingLeft: 0}}
                aria-labelledby='viewImageModalLabel'
            >
                <Modal.Body className='file-preview-modal__body'>
                    <div
                        className={'modal-image__wrapper'}
                        onClick={this.handleModalClose}
                    >
                        <div
                            className='file-preview-modal__main-ctr'
                            onMouseEnter={this.onMouseEnterImage}
                            onMouseLeave={this.onMouseLeaveImage}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Modal.Title
                                componentClass='div'
                                id='viewImageModalLabel'
                                className='file-preview-modal__title'
                            >
                                <FilePreviewModalHeader
                                    isMobileView={this.props.isMobileView}
                                    post={this.props.post}
                                    showPublicLink={showPublicLink}
                                    fileIndex={this.state.imageIndex}
                                    totalFiles={this.props.fileInfos?.length}
                                    filename={fileName}
                                    fileURL={fileDownloadUrl}
                                    fileInfo={fileInfo}
                                    enablePublicLink={this.props.enablePublicLink}
                                    canDownloadFiles={this.props.canDownloadFiles}
                                    isExternalFile={isExternalFile}
                                    handlePrev={this.handlePrev}
                                    handleNext={this.handleNext}
                                    handleModalClose={this.handleModalClose}
                                />
                                {zoomBar}
                            </Modal.Title>
                            <div
                                className={'file-preview-modal__content' + modalImageClass}
                                onClick={this.handleBgClose}
                            >
                                {content}
                            </div>
                            { this.props.isMobileView &&
                                <FilePreviewModalFooter
                                    post={this.props.post}
                                    showPublicLink={showPublicLink}
                                    filename={fileName}
                                    fileURL={fileDownloadUrl}
                                    fileInfo={fileInfo}
                                    enablePublicLink={this.props.enablePublicLink}
                                    canDownloadFiles={this.props.canDownloadFiles}
                                    isExternalFile={isExternalFile}
                                    handleModalClose={this.handleModalClose}
                                />
                            }
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
