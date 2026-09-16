import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getWeekStart } from './week.js';

export interface SubmitAnswerInput {
  questionId: string;
  value: unknown;
}

export interface SubmitResponseArgs {
  orgId: string;
  userId: string;
  surveyId: string;
  answers: SubmitAnswerInput[];
}

@Injectable()
export class SurveysService {
  async getActiveSurvey(tx: Prisma.TransactionClient, orgId: string, userId: string) {
    const survey = await tx.survey.findFirst({
      where: { orgId, isActive: true },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!survey) {
      return null;
    }

    const response = await tx.response.findFirst({
      where: { surveyId: survey.id, userId, weekStart: getWeekStart() },
    });

    return { ...survey, hasResponded: Boolean(response) };
  }

  async submitResponse(tx: Prisma.TransactionClient, { orgId, userId, surveyId, answers }: SubmitResponseArgs) {
    const survey = await tx.survey.findFirst({
      where: { id: surveyId, orgId },
      include: { questions: true },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    if (!survey.isActive) {
      throw new ConflictException('Survey is not currently active');
    }

    const questionById = new Map(survey.questions.map((question) => [question.id, question]));
    const answeredIds = new Set(answers.map((answer) => answer.questionId));

    if (answers.some((answer) => !questionById.has(answer.questionId))) {
      throw new BadRequestException('Answer references an unknown question');
    }

    if (answeredIds.size !== questionById.size || survey.questions.some((question) => !answeredIds.has(question.id))) {
      throw new BadRequestException('An answer is required for every question, exactly once');
    }

    for (const answer of answers) {
      const question = questionById.get(answer.questionId)!;

      if (question.type === 'rating' && (!Number.isInteger(answer.value) || (answer.value as number) < 1 || (answer.value as number) > 5)) {
        throw new BadRequestException(`Rating answer for question ${question.id} must be an integer 1-5`);
      }

      if (question.type === 'yesNo' && typeof answer.value !== 'boolean') {
        throw new BadRequestException(`yesNo answer for question ${question.id} must be a boolean`);
      }
    }

    try {
      return await tx.response.create({
        data: {
          surveyId: survey.id,
          userId,
          orgId,
          weekStart: getWeekStart(),
          answers: {
            create: answers.map((answer) => ({
              questionId: answer.questionId,
              value: answer.value as Prisma.InputJsonValue,
            })),
          },
        },
        include: { answers: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Already submitted a response for this survey this week');
      }
      throw error;
    }
  }

  async getSurveySummary(tx: Prisma.TransactionClient, orgId: string, surveyId: string) {
    const survey = await tx.survey.findFirst({
      where: { id: surveyId, orgId },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    if (!survey.isActive) {
      throw new ConflictException('Survey is not currently active');
    }

    const weekStart = getWeekStart();

    const [total, count, answers] = await Promise.all([
      tx.user.count({ where: { orgId, role: 'Member' } }),
      tx.response.count({ where: { surveyId, weekStart } }),
      tx.answer.findMany({
        where: { response: { surveyId, weekStart } },
        select: { questionId: true, value: true },
      }),
    ]);

    const answersByQuestion = new Map<string, unknown[]>();
    for (const answer of answers) {
      const values = answersByQuestion.get(answer.questionId) ?? [];
      values.push(answer.value);
      answersByQuestion.set(answer.questionId, values);
    }

    const questions = [...survey.questions].sort((a, b) => a.order - b.order).map((question) => {
      const values = answersByQuestion.get(question.id) ?? [];
      const base = { questionId: question.id, type: question.type, text: question.text, order: question.order };

      if (question.type === 'rating') {
        const ratingValues = values as number[];
        const average = ratingValues.length
          ? Math.round((ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length) * 100) / 100
          : null;
        return { ...base, rating: { average, count: ratingValues.length } };
      }

      const yesNoValues = values as boolean[];
      return {
        ...base,
        yesNo: {
          true: yesNoValues.filter((value) => value === true).length,
          false: yesNoValues.filter((value) => value === false).length,
        },
      };
    });

    return {
      surveyId: survey.id,
      weekStart,
      completion: {
        count,
        total,
        rate: total === 0 ? null : Math.round((count / total) * 100) / 100,
      },
      questions,
    };
  }
}
