"use strict";

class Application {
    constructor(appModel) {
        this.appModel = appModel;
        const fileExtensions = appModel.acceptedFiles.map(e => `.${e}`);

        this.dropper = new FileDropper(fileExtensions);
        this.dropper.fileLoaded = this.dropper_fileLoaded.bind(this);
        this.dropper.warningOccurred = this.dropper_warningOccurred.bind(this);
        this.dropper.errorOccurred = this.dropper_errorOccurred.bind(this);

        this.presenter = new ApplicationPresenter(this.appModel.thumbnailPattern, this.appModel.isPassCodeRequired);
        this.presenter.searchImage = this.presenter_searchImage_submit.bind(this);
        this.presenter.passCodeSubmit = this.presenter_passCode_submit.bind(this);
        this.presenter.deleteImage = this.presenter_deleteImage_click.bind(this);

        this.showImages(appModel.preloadModel);
    }

    showImages(imageMetaList) {
        this.presenter.clearOutput();

        if (imageMetaList.length === 0) {
            this.presenter.showWarning("No images found.");
            return;
        }

        const sortedModel = imageMetaList.sort((a, b) => a.time - b.time);

        for (const model of sortedModel) {
            this.presenter.showImageOutput(model);
        }
    }

    dropper_fileLoaded(fileName, image) {
        const fileSize = 0.75 * image.length;
        const fileSizeKb = Math.round(100 * fileSize / 1024) / 100;

        if (fileSizeKb > this.appModel.maxFileSizeKb) {
            const message = `The file is too big! It must be maximum ${this.appModel.maxFileSizeKb} kB`;
            this.presenter.showWarning(message);
            return;
        }

        this.presenter.scaleImage(image, this.appModel.thumbnailWidth, this.appModel.thumbnailHeight,
            this.presenter_scaleImage_ready.bind(this, fileName, image));
    }

    presenter_scaleImage_ready(fileName, image, thumbnail) {
        this.uploadFile(fileName, image, thumbnail);
    }

    dropper_warningOccurred(fileName, warningMessage) {
        const message = `Problem with file "${fileName}": ${warningMessage}`;
        this.presenter.showWarning(message)
    }

    dropper_errorOccurred(fileName, errorMessage) {
        const message = `Error with file "${fileName}": ${errorMessage}`;
        this.presenter.showError(message)
    }

    uploadFile(fileName, image, thumbnail) {
        const optionsModel = this.presenter.getSubmitOptions();
        const encodedPassCode = encodeURIComponent(optionsModel.passCode);
        const encodedFileName = encodeURIComponent(fileName);

        const headers = [
            {header: "PassCode", value: encodedPassCode},
            {header: "FileName", value: encodedFileName},
            {header: "ForceUpload", value: optionsModel.isForceUpload},
            {header: "Content-type", value: "multipart/form-data"}
        ];

        const uploadData = {image: image, thumbnail: thumbnail};
        const encodedData = JSON.stringify(uploadData);

        IoService.postData("api/upload", encodedData, headers, this.uploadFile_ready.bind(this))
    }

    uploadFile_ready(err, fileMeta) {
        if (err) {
            this.presenter.showError("Error with file upload: " + err);
        } else if (fileMeta) {
            this.presenter.showImageOutput(fileMeta);
        } else {
            this.presenter.showError("Something went wrong!");
        }
    }

    presenter_searchImage_submit(phrase) {
        const encodedSearchPhrase = encodeURIComponent(phrase);

        const headers = [
            {header: "SearchPhrase", value: encodedSearchPhrase},
        ];

        IoService.postData("api/search", {}, headers, this.searchImage_ready.bind(this))
    }

    searchImage_ready(err, data) {
        if (err) {
            this.presenter.showError("Error with search image: " + err);
        } else {
            this.showImages(data);
        }
    }

    presenter_passCode_submit(passCode) {
        const encodedPassCode = encodeURIComponent(passCode);

        const headers = [
            {header: "PassCode", value: encodedPassCode},
        ];

        IoService.postData("api/validate", {}, headers, this.validate_ready.bind(this))
    }

    validate_ready(err, isValid) {
        if (err) {
            this.presenter.showError("Error with validation: " + err);
        } else {
            if (isValid) {
                this.presenter.showUploadControls();
            } else {
                this.presenter.showWarning("Wrong pass code!")
            }
        }
    }

    presenter_deleteImage_click(fileName, messageBoxId) {
        const optionsModel = this.presenter.getSubmitOptions();
        const encodedPassCode = encodeURIComponent(optionsModel.passCode);
        const encodedFileName = encodeURIComponent(fileName);

        const headers = [
            {header: "PassCode", value: encodedPassCode},
            {header: "FileName", value: encodedFileName},
        ];

        IoService.postData("api/delete", {}, headers, this.deleteFile_ready.bind(this, messageBoxId))
    }

    deleteFile_ready(messageBoxId, err, data) {
        if (err) {
            this.presenter.showError("Error with delete image: " + err);
        } else {
            this.presenter.showInfo(data);
            this.presenter.removeMessageBox(messageBoxId);
        }
    }
}
