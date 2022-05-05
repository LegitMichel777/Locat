export enum QuestionLength {
    SHORT = "short",
    MULTILINE = "multiline",
};

export type Question = {
    index: number,
    name: string,
    length: QuestionLength,
    isOptional: boolean,
};