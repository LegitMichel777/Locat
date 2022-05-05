// pages/survey/survey.ts

import { Question } from "../../data/questions";
import allCollectionsData from "../../utils/allCollectionsData";

enum PageState {
    SUBMISSION = "submission",
    COMPLETE = "complete",
    ERROR = "error",
    PERIOD_ENDED = "periodEnded",
}

type SurveyDataInterface = {
    pageState: PageState,
    questions: Question[],
    responses: string[],
    error: string[],
    images: string[],
    imagesHeight: number,
    db: DB.Database,
};

Component({
    /**
     * Component properties
     */
    properties: {

    },

    /**
     * Component initial data
     */
    data: {} as SurveyDataInterface,

    /**
     * Component methods
     */
    methods: {
        chooseImageButtonTapped: async function() {
            if (this.data.images.length == 6) {
                return;
            }
            let result = await wx.chooseImage({
                count: 6-this.data.images.length,
            });
            
            let newImage: string[] = this.data.images;
            for (let i=0;i<result.tempFilePaths.length;i++) {
                newImage.push(result.tempFilePaths[i]);
            }

            this.setData({
                images: newImage,
            });
            
            let getGridItemSizeQuery = wx.createSelectorQuery().in(this);
            getGridItemSizeQuery.select(".image-grid-item").boundingClientRect((res) => {
                this.setData({
                    imagesHeight: res.width,
                });
            }).exec();
        },
        inputChanged: function(index: number, newValue: string) {
            let responses = this.data.responses;
            responses[index] = newValue;
            this.setData({
                responses: responses,
            });
        },
        shortInputChanged: function(x: any) {
            let index:number = x.currentTarget.dataset.index;
            let newValue = x.detail.value;
            this.inputChanged(index, newValue);
        },
        longInputChanged: function(x:any) {
            let index:number = x.currentTarget.dataset.index;
            let newValue = x.detail.value;
            this.inputChanged(index, newValue);
        },
        initData: function() {
            let newResponses: string[] = Array(this.data.questions.length);
            for (let i=0;i<newResponses.length;i++) {
                newResponses[i] = "";
            }

            let newError: string[] = Array(this.data.questions.length);
            for (let i=0;i<newError.length;i++) {
                newError[i] = "";
            }

            this.setData({
                hasCompletedSubmission: false,
                images: [],
                responses: newResponses,
                error: newError,
            });
        },
        fetchQuestions: async function() {
            let result = await allCollectionsData(this.data.db, "Questions");
            let questions = result.data;
            this.setData({
                questions: questions,
            });
        },
        fetchFinishedStatus: async function() {
            let cloudFunctionFinishedStatus = await wx.cloud.callFunction({
                name: "checkIfUserSubmitted",
            });
            let result:string = "error";
            if (cloudFunctionFinishedStatus.result !== undefined) {
                result = (cloudFunctionFinishedStatus.result! as AnyObject).result;
            }

            if (result == "true") {
                result = "complete";
            } else {
                result = await this.fetchEventFinished();
            }
            this.setData({
                pageState: result as PageState,
            });
        },
        fetchEventFinished: async function():Promise<PageState> {
            let eventFinishTimeQueryResult = await this.data.db.collection("Constants").doc("surveyCloseTime").get();
            if (eventFinishTimeQueryResult.errMsg !== "document.get:ok") {
                return PageState.ERROR;
            }

            let eventFinishTime:number = eventFinishTimeQueryResult.data.data;
            let currentTime = new Date().getTime()/1000;

            console.log(currentTime);
            if (eventFinishTime < currentTime) {
                return PageState.PERIOD_ENDED;
            }

            return PageState.SUBMISSION;
        },
        fetchFromServer: async function() {
            await this.fetchQuestions();
            await this.fetchFinishedStatus();
        },
        newRandomId: function(): string {
            // generate a length 16, base64 random id
            let base64map = new Map<Number, String>();
            // 0..<26 - lowercase letters
            for (let i=0;i<26;i++) {
                base64map.set(i, String.fromCharCode(i+65));
            }
            // 26..<52 - lowercase letters
            for (let i=0;i<26;i++) {
                base64map.set(i+26, String.fromCharCode(i+97));
            }
            // 52..<62 - numbers
            for (let i=0;i<10;i++) {
                base64map.set(i+52, String.fromCharCode(i+48));
            }
            base64map.set(62, "+");
            base64map.set(63, "=");
            
            let result = "";
            for (let i=0;i<16;i++) {
                result+=base64map.get(Math.floor(Math.random()*64));
            }
            return result;
        },
        submitTapped: function() {
            let canSubmit = true;
            let newError = this.data.error;
            for (let i=0;i<this.data.questions.length;i++) {
                newError[i] = "";
                if (this.data.responses[i] === "" && !this.data.questions[i].isOptional) {
                    // we got a problem. its a required field!
                    canSubmit = false;
                    newError[i] = "*required response";
                }
            }

            this.setData({
                error: newError,
            });

            if (canSubmit) {
                // submit it
                let responses=[];
                for (let i=0;i<this.data.questions.length;i++) {
                    responses.push({
                        questionName: this.data.questions[i].name,
                        questionResponse: this.data.responses[i],
                    });
                }

                // generate filenames for all of the images
                let generatedFilenames: string[] = Array(this.data.images.length);
                for (let i=0;i<this.data.images.length;i++) {
                    generatedFilenames[i] = `${this.newRandomId()}.${this.getFileExtension(this.data.images[i])}`;
                }

                for (let i=0;i<this.data.images.length;i++) {
                    wx.cloud.uploadFile({
                        cloudPath: `SurveyCats/${generatedFilenames[i]}`,
                        filePath: this.data.images[i],
                    });
                }

                this.data.db.collection("Responses").add({data: {
                    response: responses,
                    uploadedPhotos: generatedFilenames,
                }}).then(() => {
                    this.setData({
                        pageState: PageState.COMPLETE,
                    });
                })
            }
        },
        deleteImage: function(x: any) {
            let deleteImageIndex: number = x.currentTarget.dataset.index;
            let newImages = this.data.images;
            console.log(deleteImageIndex);
            newImages.splice(deleteImageIndex, 1);
            this.setData({
                images: newImages
            });
        },
        getFileExtension: function(x: string) {
            // e.g. input hello.jpeg, returns jpeg
            let index = x.lastIndexOf(".");
            if (index === -1) {
                return "";
            }
            return x.substr(index+1);
        },
        onLoad: function() {
            wx.cloud.init();
            this.data.db = wx.cloud.database();
            this.fetchFromServer().then((res) =>  {
                this.initData();
            });
        }
    }
})
