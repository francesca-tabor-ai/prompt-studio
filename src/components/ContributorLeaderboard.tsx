import { Trophy, Award, Medal, TrendingUp, Star } from 'lucide-react';
import { ContributorStats } from '../services/collaborationService';

interface ContributorLeaderboardProps {
  contributors: ContributorStats[];
}

export default function ContributorLeaderboard({ contributors }: ContributorLeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-orange-600" />;
      default:
        return (
          <div className="w-6 h-6 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-500">{rank}</span>
          </div>
        );
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-300';
      case 2:
        return 'bg-gradient-to-r from-gray-100 to-gray-50 border-gray-300';
      case 3:
        return 'bg-gradient-to-r from-orange-100 to-orange-50 border-orange-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-yellow to-jungle-green">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl text-white">TOP CONTRIBUTORS</h3>
            <p className="text-sm text-white/80">Community leaderboard and recognition</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {contributors.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-green-yellow/20 to-jungle-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-jungle-green" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">No Contributors Yet</h4>
            <p className="text-sm text-gray-600">
              Be the first to submit prompts and reviews to earn points
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {contributors.map((contributor, index) => {
              const rank = index + 1;
              return (
                <div
                  key={contributor.id}
                  className={`rounded-lg p-4 border-2 transition-all duration-200 hover:shadow-md ${getRankColor(
                    rank
                  )}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-shrink-0">{getRankIcon(rank)}</div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900">{contributor.contributor_name}</h4>
                          {rank <= 3 && (
                            <span className="px-2 py-0.5 bg-green-yellow/20 text-jungle-green rounded text-xs font-semibold">
                              TOP {rank}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>{contributor.submissions_count} submissions</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            <span>{contributor.approvals_count} approved</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            <span>{contributor.reviews_count} reviews</span>
                          </div>
                          {contributor.avg_rating > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-green-yellow">⭐</span>
                              <span>{contributor.avg_rating.toFixed(1)} avg rating</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <div className="text-2xl font-bold text-jungle-green">
                          {contributor.points}
                        </div>
                        <div className="text-xs text-gray-600">points</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 bg-gradient-to-r from-light-sea-green/10 to-green-yellow/10 rounded-lg p-4 border border-light-sea-green/20">
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-jungle-green" />
            Points System
          </h4>
          <div className="space-y-2 text-xs text-gray-700">
            <div className="flex items-center justify-between">
              <span>Submit a prompt</span>
              <span className="font-bold text-jungle-green">+10 points</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Review a submission</span>
              <span className="font-bold text-jungle-green">+5 points</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Get a prompt approved</span>
              <span className="font-bold text-jungle-green">+15 points</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
