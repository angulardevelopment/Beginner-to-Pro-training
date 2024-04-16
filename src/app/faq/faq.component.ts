import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Params } from '@angular/router';
import {Token, marked, lexer, Tokens} from 'marked';
import { Observable, Subscription, map } from 'rxjs';

@Component({
  selector: 'app-faq',
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss']
})
export class FaqComponent implements OnInit {

  public params: Params;
  public loading: boolean = true;
  public errorLoading: boolean = false;
  public parsedMarkdown: Token[];
  public sectionedFaqs: IFaq[] = [];
  public subscription: Subscription;

  constructor(
    private http: HttpClient
  ) { }

  ngOnInit() {
    this.subscription = this.getFaqMarkdown().subscribe(
      (result: string) => {
        // parse markdown file to objects
        this.parsedMarkdown = lexer(result);
        // create sections to be used in template
        this.sectionedFaqs = this.sectionCategories(this.parsedMarkdown);
      },
      (error) => {
        this.errorLoading = true;
        this.loading = false;
      },
      () => {
        this.loading = false;
      }
    )
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  public getFaqMarkdown(): Observable<string> {
    return this.http.get('assets/portal-faq.md', { responseType: 'text' }).pipe(
      map(markdown => markdown)
    )
  }

  public sectionCategories(tokens: Token[]): IFaq[] {
    const sectionedFaqs = [];
    const categoryIndices = this.findHeadingIndices(tokens, 1);

    for (let index = 0; index < categoryIndices.length - 1; index += 1) {

      let questions = this.sliceTokenList(tokens, index, categoryIndices);

      let questionIndices = this.findHeadingIndices(questions, 2);

      sectionedFaqs.push(
        {
          category: tokens[categoryIndices[index]],
          questions: this.sectionQuestions(questions, questionIndices)
        }
      )
    }

    return sectionedFaqs;
  }

  public sectionQuestions(parsedQuestionMarkdown: Token[], indices: number[]): IFaqQuestion[] {
    // section out each question within each category
    const sectionedQuestions = [];

    for (let index = 0; index < indices.length - 1; index += 1) {
      const question = parsedQuestionMarkdown[indices[index]]

      sectionedQuestions.push(
        {
          question,
          refId: this.formatId(question['text']),
          content: this.sliceTokenList(parsedQuestionMarkdown, index, indices)
        }
      )
    }

    return sectionedQuestions;
  }

  public sliceTokenList(tokens: Token[], currentIndex: number, indices: number[]): Token[] {
    // return the section of the array for a specific category
    return tokens.slice(indices[currentIndex] + 1, indices[currentIndex + 1]);
  }

  public findHeadingIndices(markdownTokens: Token[], depth: number): number[] {
    // get index of each header to parse token array into sections
    let indices = [];
    markdownTokens.forEach((token, i) => {
      if (token.type === 'heading' && token['depth'] === depth) {
        indices.push(i);
      }
    });
    indices.push(markdownTokens.length);
    return indices;
  }

  public formatId(label: string): string {
    let result = '';
    if (label) {
      // Remove special characters, ignore spaces
      result = label.replace(/[^a-zA-Z0-9 ]/g, '');
      // Convert spaces to dashes
      result = result.replace(/\s+/g, '-').toLowerCase();
    }
    return result;
  }

  public renderMarkdown(markdown: string) {
    return marked(markdown, { renderer });
  }

  public get faqRef(): string {
    return this.params ? this.params[FAQQueryParamEnum.ReferenceId] : null;
  }

  public scrollToFaq(): void {
  }

}

export enum FAQQueryParamEnum {
  ReferenceId = 'refId'
}

export interface IFaq {
  category: Tokens.Heading;
  questions: IFaqQuestion[];
}

export interface IFaqQuestion {
  question: Tokens.Heading;
  refId: string;
  content: Token[];
}

const renderer = new marked.Renderer();
const linkRenderer = renderer.link;
// overwrite the link html to always open in a new window
renderer.link = (href, title, text) => {
    const html = linkRenderer.call(renderer, href, title, text);
    return html.replace(/^<a /, '<a target="_blank" rel="nofollow" ');
};