import { animate, style, transition, trigger } from '@angular/animations';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin, Subscription, timer } from 'rxjs';
import { finalize, map, take, tap } from 'rxjs/operators';
import { ViewObject } from './models';
import { OrganizzeService } from './service';

const MONTHS_NAMES = [
  '',
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// const CLOSING_DATE = 1;
const TIMER_RELOAD = 3 * 60;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [
    trigger('enterAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate(150, style({ opacity: 1 }))
      ]),
      transition(':leave', [
        style({ opacity: 1 }),
        animate(300, style({ opacity: 0 }))
      ])
    ])
  ]
})
export class AppComponent implements OnInit, OnDestroy {

  private month: number;
  private year: number;
  private dayProgress: number;
  private countdownTimer: Subscription;

  public countdownPercent: number = 100;
  public loading = false;
  public total: ViewObject.Budget;
  public budgets: ViewObject.Budget[] = [];

  constructor(
    private organizzeService: OrganizzeService
  ) { }

  ngOnInit() {
    this.changeMonth(0);
    this.chainFactory();
  }

  ngOnDestroy() {
    this.resetCountdown();
  }

  public get currentMonth() {
    return `${MONTHS_NAMES[this.month]}/${this.year}`;
  }

  private changeMonth(month: number = 0) {
    const today = new Date();
    const currentMonthYear = new Date(today.getFullYear(), today.getMonth());
    currentMonthYear.setTime(currentMonthYear.getTime() + currentMonthYear.getTimezoneOffset() * 60 * 1000);

    const baseMonth = this.month || currentMonthYear.getMonth() + 1;
    const baseYear = this.year || currentMonthYear.getFullYear();

    const baseMonthYear = new Date(baseYear, (baseMonth - 1) + month);
    baseMonthYear.setTime(baseMonthYear.getTime() + baseMonthYear.getTimezoneOffset() * 60 * 1000);

    if (currentMonthYear.getTime() === baseMonthYear.getTime()) {
      const totalDays: number = (new Date(currentMonthYear.getFullYear(), currentMonthYear.getMonth() + 1, 0)).getDate();
      const todayDay: number = (new Date()).getDate();
      this.dayProgress = (todayDay * 100) / totalDays;

    } else {
      this.dayProgress = null;
    }

    this.month = baseMonthYear.getMonth() + 1;
    this.year = baseMonthYear.getFullYear();
  }

  public prevMonth() {
    this.changeMonth(-1);
    this.chainFactory();
  }

  public nextMonth() {
    this.changeMonth(+1);
    this.chainFactory();
  }

  private startCountdown() {
    this.resetCountdown();

    this.countdownTimer = timer(0, 1000)
      .pipe(
        take(TIMER_RELOAD + 1),
        map(value => TIMER_RELOAD - value),
        tap(value => this.countdownPercent = (value * 100) / TIMER_RELOAD),
        finalize(() => {
          if (this.countdownPercent === 0) {
            this.chainFactory();
          }
        })
      )
      .subscribe();
  }

  private resetCountdown() {
    if (this.countdownTimer) {
      this.countdownTimer.unsubscribe();
    }
    this.countdownPercent = 100;
  }

  private chainFactory(): Subscription {
    this.resetCountdown();
    this.loading = true;

    return forkJoin([
      this.organizzeService.getCategories(),
      this.organizzeService.getBudgets(this.year, this.month),
      // this.organizzeService.getAllTransactions(this.baseDate),
    ])
      .pipe(
        map(([categories, budgets]) => {
          const newBudgets: ViewObject.Budget[] = budgets.map((budget) => {
            const category = categories.find(item => item.id === budget.category_id);
            // filtrar transactions
            let newBudget: ViewObject.Budget;
            newBudget = {
              ...budget,
              category_color: category.color,
              category_name: category.name,
              transactions: [],
            };
            return newBudget;
          });
          return newBudgets;
        }),
        tap((budgets: ViewObject.Budget[]) => {
          this.budgets = budgets;
          // console.log('chainFactory_final', budgets);
        }),
        finalize(() => {
          // this.startCountdown();
          setTimeout(() => this.loading = false, 300);
        })
      )
      .subscribe();
  }

}
